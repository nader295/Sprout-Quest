/**
 * lib/server/providers/pixeldrain.ts
 *
 * Pixeldrain integration helpers.
 *
 * API docs: https://pixeldrain.com/api
 *
 * Auth: HTTP Basic, with empty username and the API key as password.
 *   Authorization: Basic base64(":<apikey>")
 *
 * Endpoints used:
 *   GET  /api/user                           → verify key (404/401 if invalid)
 *   POST /api/file (multipart "file" + "name") → upload (used by server proxy)
 *   PUT  /api/file/{name}                    → upload (used by direct browser flow)
 *
 * Successful upload response:
 *   { "id": "abc123" }
 * Public URL: https://pixeldrain.com/u/{id}
 */

const PIXELDRAIN_API = "https://pixeldrain.com/api";
export const PIXELDRAIN_BASE_URL = "https://pixeldrain.com";

export function pixeldrainAuthHeader(apiKey: string): string {
  // ":<apiKey>" — username empty, password is the key
  const token = Buffer.from(`:${apiKey}`).toString("base64");
  return `Basic ${token}`;
}

export function pixeldrainPublicUrl(fileId: string): string {
  return `${PIXELDRAIN_BASE_URL}/u/${encodeURIComponent(fileId)}`;
}

/** Returns the canonical PUT URL the browser will upload to. */
export function pixeldrainPutUrl(fileName: string): string {
  // Pixeldrain accepts arbitrary file names; ensure clean encoding.
  return `${PIXELDRAIN_API}/file/${encodeURIComponent(fileName)}`;
}

export interface PixeldrainTestResult {
  ok: boolean;
  reason?: string;
  status?: number;
}

/** Quickly validate that an API key is accepted by Pixeldrain. */
export async function pixeldrainTestKey(apiKey: string): Promise<PixeldrainTestResult> {
  try {
    const res = await fetch(`${PIXELDRAIN_API}/user`, {
      headers: { Authorization: pixeldrainAuthHeader(apiKey) },
    });
    if (res.ok) return { ok: true, status: res.status };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "Pixeldrain rejected this key (unauthorized)", status: res.status };
    }
    if (res.status === 404) {
      // Some keys can hit the legacy `/user/files` instead — try that as a fallback
      const r2 = await fetch(`${PIXELDRAIN_API}/user/files`, {
        headers: { Authorization: pixeldrainAuthHeader(apiKey) },
      });
      if (r2.ok) return { ok: true, status: r2.status };
      return { ok: false, reason: "Pixeldrain returned 404 for this key", status: r2.status };
    }
    const txt = await res.text().catch(() => "");
    return { ok: false, reason: txt.slice(0, 200) || `HTTP ${res.status}`, status: res.status };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/**
 * Classify a Pixeldrain upload error into a key status.
 *  - 401/403 → invalid (key revoked or wrong)
 *  - 402/429 → exhausted (out of credit / rate limit)
 *  - other   → null (transient, don't poison the key)
 */
export function classifyPixeldrainError(status: number, body: string): { status: "invalid" | "exhausted" | null; reason: string } {
  const lower = body.toLowerCase();
  if (status === 401 || status === 403) {
    return { status: "invalid", reason: "Unauthorized — key may be revoked" };
  }
  if (status === 402 || lower.includes("payment required") || lower.includes("quota")) {
    return { status: "exhausted", reason: "Out of Pixeldrain credit" };
  }
  if (status === 429 || lower.includes("rate limit")) {
    return { status: "exhausted", reason: "Rate limited by Pixeldrain" };
  }
  return { status: null, reason: body.slice(0, 200) || `HTTP ${status}` };
}

/**
 * Upload a single file via the server. Used by the small-file proxy route.
 * For ROM-sized uploads, prefer the direct browser→Pixeldrain flow.
 */
export async function pixeldrainServerUpload(
  apiKey: string,
  file: { stream: ReadableStream<Uint8Array> | Blob; name: string; size: number; type?: string },
): Promise<{ ok: true; id: string; url: string } | { ok: false; status: number; body: string }> {
  const fd = new FormData();
  // Convert ReadableStream → Blob if needed
  const blob =
    file.stream instanceof Blob
      ? file.stream
      : await new Response(file.stream).blob();
  fd.append("file", blob, file.name);
  if (file.name) fd.append("name", file.name);

  const res = await fetch(`${PIXELDRAIN_API}/file`, {
    method: "POST",
    headers: {
      Authorization: pixeldrainAuthHeader(apiKey),
    },
    body: fd,
  });

  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: text };
  }
  try {
    const json = JSON.parse(text) as { id?: string };
    if (!json.id) return { ok: false, status: 500, body: "Pixeldrain returned no file id" };
    return { ok: true, id: json.id, url: pixeldrainPublicUrl(json.id) };
  } catch {
    return { ok: false, status: 500, body: "Invalid Pixeldrain response" };
  }
}
