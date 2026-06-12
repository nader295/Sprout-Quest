/**
 * /api/user/api-keys
 *
 * Per-user CRUD for upload provider API keys (Pixeldrain to start).
 *
 *   GET    ?provider=pixeldrain         → list keys (no plaintext)
 *   POST   { action: "create" | "update" | "delete" | "test", ... }
 *
 * All endpoints require auth. Plaintext keys are NEVER returned.
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
  listKeys,
  addKey,
  updateKey,
  deleteKey,
  type ApiKeyProvider,
} from "@/lib/server/api-key-manager";
import { getKeyWithPlaintext } from "@/lib/server/api-key-manager";
import { pixeldrainTestKey } from "@/lib/server/providers/pixeldrain";

const SUPPORTED: ApiKeyProvider[] = ["pixeldrain"];

function isProvider(p: unknown): p is ApiKeyProvider {
  return typeof p === "string" && (SUPPORTED as string[]).includes(p);
}

export async function GET(req: NextRequest) {
  const user = await verifyRequest(req).catch(() => null);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const ip = getClientIp(req);
  if (!(await rateLimitUserOrIp(user.uid, ip, { perUser: 60, perIp: 120, scope: "apikeys-list" }))) {
    return rateLimitedResponse(req);
  }

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider");
  const filter = isProvider(provider) ? provider : undefined;
  try {
    const items = await listKeys(user.uid, filter);
    return jsonResponse({ items }, 200, req);
  } catch (err) {
    return errorResponse((err as Error).message || "Failed to list keys", 500, req);
  }
}

export async function POST(req: NextRequest) {
  const user = await verifyRequest(req).catch(() => null);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const ip = getClientIp(req);
  if (!(await rateLimitUserOrIp(user.uid, ip, { perUser: 20, perIp: 60, scope: "apikeys-mutate" }))) {
    return rateLimitedResponse(req);
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action as string;

  try {
    if (action === "create") {
      if (!isProvider(body.provider)) return errorResponse("Unsupported provider", 400, req);
      const created = await addKey({
        uid: user.uid,
        provider: body.provider,
        plaintextKey: String(body.key || ""),
        label: typeof body.label === "string" ? body.label : "",
        priority: typeof body.priority === "number" ? body.priority : 0,
      });
      return jsonResponse({ ok: true, item: created }, 200, req);
    }

    if (action === "update") {
      if (!body.id) return errorResponse("Missing id", 400, req);
      const updated = await updateKey({
        uid: user.uid,
        id: String(body.id),
        label: typeof body.label === "string" ? body.label : undefined,
        priority: typeof body.priority === "number" ? body.priority : undefined,
        status: body.status,
        plaintextKey: typeof body.key === "string" && body.key.trim() ? body.key : undefined,
      });
      return jsonResponse({ ok: true, item: updated }, 200, req);
    }

    if (action === "delete") {
      if (!body.id) return errorResponse("Missing id", 400, req);
      await deleteKey(user.uid, String(body.id));
      return jsonResponse({ ok: true }, 200, req);
    }

    if (action === "test") {
      if (!body.id) return errorResponse("Missing id", 400, req);
      const found = await getKeyWithPlaintext(user.uid, String(body.id));
      if (!found) return errorResponse("Key not found", 404, req);
      if (found.row.provider === "pixeldrain") {
        const result = await pixeldrainTestKey(found.plaintext);
        return jsonResponse({ ok: result.ok, reason: result.reason || null }, 200, req);
      }
      return errorResponse("Test not implemented for provider", 400, req);
    }

    return errorResponse("Unknown action", 400, req);
  } catch (err) {
    return errorResponse((err as Error).message || "Request failed", 400, req);
  }
}
