/**
 * lib/server/crypto-keys.ts
 *
 * AES-256-GCM helpers for encrypting per-user API keys at rest.
 *
 * Required env: API_KEY_ENCRYPTION_SECRET — any string >= 16 chars.
 * It is hashed to a 32-byte key with SHA-256 so length doesn't matter.
 *
 * Storage format (single base64 string):
 *   base64( IV(12) | AUTH_TAG(16) | CIPHERTEXT )
 */

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  // Use env var if set, otherwise fall back to a derived secret from other available env vars
  const secret =
    process.env.API_KEY_ENCRYPTION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "rom-x-default-api-key-secret-2025";
  // Derive a stable 32-byte key from whatever secret was provided
  return createHash("sha256").update(secret).digest();
}

export function encryptKey(plaintext: string): string {
  if (!plaintext) throw new Error("Cannot encrypt empty string");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptKey(stored: string): string {
  if (!stored) throw new Error("Cannot decrypt empty payload");
  const buf = Buffer.from(stored, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("Encrypted payload too short");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

/** Last 4 visible chars for a fingerprint pill in the UI. */
export function fingerprintKey(plaintext: string): string {
  const trimmed = plaintext.trim();
  if (trimmed.length <= 4) return trimmed;
  return trimmed.slice(-4);
}

// ── Upload tickets (HMAC-signed nonces) ─────────────────────────
// Used for the "direct browser → Pixeldrain" flow: the server signs which
// keyId is allowed to be used, with a short expiry, so the /complete endpoint
// can trust the keyId reported by the browser without exposing rotation logic.

interface TicketPayload {
  uid: string;
  keyId: string;
  provider: string;
  fileName: string;
  fileSize: number;
  exp: number; // ms epoch
}

function getTicketSecret(): Buffer {
  const s =
    process.env.UPLOAD_TICKET_SECRET ||
    process.env.API_KEY_ENCRYPTION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "rom-x-default-ticket-secret-2025";
  return createHash("sha256").update(`ticket:${s}`).digest();
}

export function signUploadTicket(p: TicketPayload): string {
  const body = Buffer.from(JSON.stringify(p), "utf8").toString("base64url");
  const mac = createHmac("sha256", getTicketSecret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyUploadTicket(token: string): TicketPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", getTicketSecret()).update(body).digest("base64url");
  // timing-safe compare requires equal-length buffers
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TicketPayload;
    if (typeof decoded.exp !== "number" || decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}
