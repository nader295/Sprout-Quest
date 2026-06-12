/**
 * /api/upload/pixeldrain
 *
 * Three actions, all gated by user auth:
 *
 *   GET   ?action=ticket&fileName=...&fileSize=...
 *     → Picks the active key and signs an upload ticket. Returns:
 *         { ticket, apiKey, keyId, fingerprint, fileName, uploadUrl, putHeader }
 *       The browser then PUTs the file directly to Pixeldrain.
 *
 *   POST  body { action: "complete", ticket, fileId?, success, errorStatus?, errorBody? }
 *     → Updates usage stats, marks the key exhausted on failure, or returns
 *       the public URL on success.
 *
 *   POST  multipart/form-data with file=...
 *     → Server-side proxy upload (small files only — Vercel ~4.5 MB body limit).
 *       Auto-rotates to the next active key when one fails.
 */
import { NextRequest } from "next/server";
import {
  jsonResponse,
  errorResponse,
  rateLimitedResponse,
  rateLimitUserOrIp,
  getClientIp,
} from "@/lib/api/middleware";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import {
  pickActiveKey,
  getKeyWithPlaintext,
  markKey,
  recordUsage,
} from "@/lib/server/api-key-manager";
import {
  pixeldrainPutUrl,
  pixeldrainPublicUrl,
  pixeldrainAuthHeader,
  pixeldrainServerUpload,
  classifyPixeldrainError,
} from "@/lib/server/providers/pixeldrain";
import { signUploadTicket, verifyUploadTicket } from "@/lib/server/crypto-keys";

// Browsers can only upload to Pixeldrain directly. Large files are streamed
// from the user's machine — they never touch our server. The server proxy
// branch is for small files (Vercel functions reject bodies >4.5MB).
export const runtime = "nodejs";
export const maxDuration = 60;

const TICKET_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_PROXY_BYTES = 4 * 1024 * 1024; // 4 MB, leaves headroom under Vercel's 4.5MB cap

function maskKey(plain: string): string {
  if (plain.length <= 4) return "****";
  return `${plain.slice(0, 2)}…${plain.slice(-4)}`;
}

export async function GET(req: NextRequest) {
  const user = await verifyRequest(req).catch(() => null);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const ip = getClientIp(req);
  if (!(await rateLimitUserOrIp(user.uid, ip, { perUser: 30, perIp: 90, scope: "px-ticket" }))) {
    return rateLimitedResponse(req);
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  if (action !== "ticket") return errorResponse("Unknown action", 400, req);

  const fileName = (searchParams.get("fileName") || "").trim().slice(0, 255);
  const fileSize = Number(searchParams.get("fileSize") || 0);
  if (!fileName) return errorResponse("Missing fileName", 400, req);
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return errorResponse("Missing or invalid fileSize", 400, req);
  }

  const picked = await pickActiveKey(user.uid, "pixeldrain");
  if (!picked) {
    return jsonResponse(
      { ok: false, code: "NO_ACTIVE_KEY", error: "No active Pixeldrain key — add one first." },
      200,
      req,
    );
  }

  const ticket = signUploadTicket({
    uid: user.uid,
    keyId: picked.row.id,
    provider: "pixeldrain",
    fileName,
    fileSize,
    exp: Date.now() + TICKET_TTL_MS,
  });

  return jsonResponse(
    {
      ok: true,
      ticket,
      keyId: picked.row.id,
      fingerprint: picked.row.fingerprint,
      label: picked.row.label,
      maskedKey: maskKey(picked.plaintext),
      // The browser uses these to PUT directly to Pixeldrain.
      apiKey: picked.plaintext,
      uploadUrl: pixeldrainPutUrl(fileName),
      authHeader: pixeldrainAuthHeader(picked.plaintext),
    },
    200,
    req,
  );
}

export async function POST(req: NextRequest) {
  const user = await verifyRequest(req).catch(() => null);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const ip = getClientIp(req);
  if (!(await rateLimitUserOrIp(user.uid, ip, { perUser: 20, perIp: 60, scope: "px-upload" }))) {
    return rateLimitedResponse(req);
  }

  const contentType = req.headers.get("content-type") || "";

  // ── Branch 1: complete (JSON) ─────────────────────────────────
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    if (body?.action !== "complete") return errorResponse("Unknown action", 400, req);

    const ticket = String(body.ticket || "");
    const payload = verifyUploadTicket(ticket);
    if (!payload || payload.uid !== user.uid || payload.provider !== "pixeldrain") {
      return errorResponse("Invalid or expired ticket", 400, req);
    }

    if (body.success && body.fileId) {
      const fileId = String(body.fileId).slice(0, 64);
      await recordUsage(user.uid, payload.keyId, payload.fileSize || 0);
      return jsonResponse(
        {
          ok: true,
          url: pixeldrainPublicUrl(fileId),
          fileId,
          fileName: payload.fileName,
          fileSize: payload.fileSize,
        },
        200,
        req,
      );
    }

    // Failure path — classify and rotate
    const status = Number(body.errorStatus || 0);
    const reason = String(body.errorBody || "").slice(0, 500);
    const cls = classifyPixeldrainError(status, reason);
    if (cls.status) {
      await markKey(user.uid, payload.keyId, {
        status: cls.status,
        reason: cls.reason,
        lastError: `[${status}] ${reason}`,
      });
      // Was the user able to fall back to another key? Tell the client so
      // the UI can prompt a retry / show a notice.
      const next = await pickActiveKey(user.uid, "pixeldrain");
      return jsonResponse(
        {
          ok: false,
          rotated: !!next,
          newKeyId: next?.row.id || null,
          status: cls.status,
          reason: cls.reason,
        },
        200,
        req,
      );
    }
    // Transient — just record the error
    await markKey(user.uid, payload.keyId, { lastError: `[${status}] ${reason}` });
    return jsonResponse({ ok: false, rotated: false, status: null, reason: cls.reason }, 200, req);
  }

  // ── Branch 2: server-side proxy upload (multipart) ─────────────
  if (!contentType.includes("multipart/form-data")) {
    return errorResponse("Unsupported content type", 415, req);
  }

  const form = await req.formData().catch(() => null);
  if (!form) return errorResponse("Invalid form data", 400, req);
  const file = form.get("file");
  if (!(file instanceof File)) return errorResponse("Missing file", 400, req);
  if (file.size <= 0) return errorResponse("Empty file", 400, req);
  if (file.size > MAX_PROXY_BYTES) {
    return errorResponse(
      `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — use the direct upload mode for files over ${MAX_PROXY_BYTES / 1024 / 1024} MB.`,
      413,
      req,
    );
  }

  // Try active keys in priority order, rotating on classified failures.
  const tried = new Set<string>();
  for (let attempt = 0; attempt < 5; attempt++) {
    const picked = await pickActiveKey(user.uid, "pixeldrain");
    if (!picked) {
      return jsonResponse(
        { ok: false, code: "NO_ACTIVE_KEY", error: "No active Pixeldrain key — add one first." },
        200,
        req,
      );
    }
    if (tried.has(picked.row.id)) {
      // We've already tried (and exhausted) this one — stop the loop to avoid
      // infinitely rotating the same id.
      return jsonResponse(
        { ok: false, code: "ALL_KEYS_EXHAUSTED", error: "All your Pixeldrain keys are exhausted." },
        200,
        req,
      );
    }
    tried.add(picked.row.id);

    const result = await pixeldrainServerUpload(picked.plaintext, {
      stream: file,
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (result.ok) {
      await recordUsage(user.uid, picked.row.id, file.size);
      return jsonResponse(
        {
          ok: true,
          url: result.url,
          fileId: result.id,
          keyId: picked.row.id,
          fingerprint: picked.row.fingerprint,
          fileName: file.name,
          fileSize: file.size,
        },
        200,
        req,
      );
    }

    const cls = classifyPixeldrainError(result.status, result.body);
    if (cls.status) {
      await markKey(user.uid, picked.row.id, {
        status: cls.status,
        reason: cls.reason,
        lastError: `[${result.status}] ${result.body.slice(0, 200)}`,
      });
      // continue to next attempt with another key
      continue;
    }
    // Transient — bail out so the user can retry rather than burning attempts
    await markKey(user.uid, picked.row.id, {
      lastError: `[${result.status}] ${result.body.slice(0, 200)}`,
    });
    return jsonResponse(
      { ok: false, code: "PROVIDER_ERROR", error: cls.reason || "Pixeldrain rejected the upload." },
      200,
      req,
    );
  }

  return jsonResponse(
    { ok: false, code: "ALL_KEYS_EXHAUSTED", error: "All your Pixeldrain keys are exhausted." },
    200,
    req,
  );
}
