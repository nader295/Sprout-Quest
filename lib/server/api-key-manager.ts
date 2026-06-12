/**
 * lib/server/api-key-manager.ts
 *
 * Server-side manager for per-user upload provider API keys.
 *
 * Responsibilities:
 *   - List a user's keys for a given provider (with masked fingerprint)
 *   - Pick the next active key (priority DESC, oldest first)
 *   - Add / update / delete / reactivate keys
 *   - Mark a key exhausted/invalid (called by upload routes on failure)
 *   - Increment usage counters after a successful upload
 *
 * Plaintext keys never leave this module unless explicitly requested
 * via getPlaintextKey() which is only used in two places:
 *   1. The "test key" route (which never returns the key)
 *   2. The Pixeldrain server proxy upload (server-to-server)
 *   3. The signed upload ticket (returns to authenticated user only)
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { encryptKey, decryptKey, fingerprintKey } from "./crypto-keys";

export type ApiKeyProvider = "pixeldrain" | "gofile" | "buzzheavier";
export type ApiKeyStatus = "active" | "exhausted" | "invalid" | "disabled";

export interface UserApiKeyRow {
  id: string;
  user_id: string;
  provider: ApiKeyProvider;
  label: string;
  encrypted_key: string;
  fingerprint: string;
  status: ApiKeyStatus;
  priority: number;
  exhausted_at: string | null;
  exhausted_reason: string | null;
  uploads_count: number;
  bytes_uploaded: number;
  last_used_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicApiKey {
  id: string;
  provider: ApiKeyProvider;
  label: string;
  fingerprint: string;
  status: ApiKeyStatus;
  priority: number;
  uploadsCount: number;
  bytesUploaded: number;
  lastUsedAt: string | null;
  exhaustedAt: string | null;
  exhaustedReason: string | null;
  lastError: string | null;
  createdAt: string;
}

const TABLE = "user_api_keys";
const MAX_KEYS_PER_PROVIDER = 5;

function toPublic(row: UserApiKeyRow): PublicApiKey {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label || "",
    fingerprint: row.fingerprint || "",
    status: row.status,
    priority: row.priority,
    uploadsCount: row.uploads_count || 0,
    bytesUploaded: row.bytes_uploaded || 0,
    lastUsedAt: row.last_used_at,
    exhaustedAt: row.exhausted_at,
    exhaustedReason: row.exhausted_reason,
    lastError: row.last_error,
    createdAt: row.created_at,
  };
}

export async function listKeys(uid: string, provider?: ApiKeyProvider): Promise<PublicApiKey[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from(TABLE).select("*").eq("user_id", uid).order("priority", { ascending: false }).order("created_at", { ascending: true });
  if (provider) q = q.eq("provider", provider);
  const { data, error } = await q;
  if (error) throw new Error(`[api-key-manager] listKeys: ${error.message}`);
  return (data ?? []).map((r) => toPublic(r as UserApiKeyRow));
}

export async function countKeys(uid: string, provider: ApiKeyProvider): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count } = await sb
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .eq("user_id", uid)
    .eq("provider", provider);
  return count || 0;
}

export async function addKey(input: {
  uid: string;
  provider: ApiKeyProvider;
  plaintextKey: string;
  label?: string;
  priority?: number;
}): Promise<PublicApiKey> {
  const key = input.plaintextKey.trim();
  if (!key) throw new Error("API key cannot be empty");
  if (key.length < 8) throw new Error("API key looks too short");
  if (key.length > 512) throw new Error("API key looks too long");

  const existing = await countKeys(input.uid, input.provider);
  if (existing >= MAX_KEYS_PER_PROVIDER) {
    throw new Error(`Maximum ${MAX_KEYS_PER_PROVIDER} keys per provider — delete one first`);
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      user_id: input.uid,
      provider: input.provider,
      label: (input.label || "").slice(0, 80),
      encrypted_key: encryptKey(key),
      fingerprint: fingerprintKey(key),
      status: "active",
      priority: typeof input.priority === "number" ? input.priority : 0,
    })
    .select("*")
    .single();
  if (error) throw new Error(`[api-key-manager] addKey: ${error.message}`);
  return toPublic(data as UserApiKeyRow);
}

export async function updateKey(input: {
  uid: string;
  id: string;
  label?: string;
  priority?: number;
  status?: ApiKeyStatus;
  plaintextKey?: string;
}): Promise<PublicApiKey> {
  const sb = getSupabaseAdmin();
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.label = input.label.slice(0, 80);
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.status !== undefined) patch.status = input.status;
  if (input.plaintextKey) {
    const key = input.plaintextKey.trim();
    if (key.length < 8) throw new Error("API key looks too short");
    patch.encrypted_key = encryptKey(key);
    patch.fingerprint = fingerprintKey(key);
    // Reactivate when the key is replaced
    if (input.status === undefined) patch.status = "active";
    patch.exhausted_at = null;
    patch.exhausted_reason = null;
    patch.last_error = null;
  }
  if (Object.keys(patch).length === 0) {
    // Nothing to update — just read & return
    const { data } = await sb.from(TABLE).select("*").eq("id", input.id).eq("user_id", input.uid).single();
    if (!data) throw new Error("Key not found");
    return toPublic(data as UserApiKeyRow);
  }
  const { data, error } = await sb
    .from(TABLE)
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", input.uid)
    .select("*")
    .single();
  if (error) throw new Error(`[api-key-manager] updateKey: ${error.message}`);
  if (!data) throw new Error("Key not found");
  return toPublic(data as UserApiKeyRow);
}

export async function deleteKey(uid: string, id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from(TABLE).delete().eq("id", id).eq("user_id", uid);
  if (error) throw new Error(`[api-key-manager] deleteKey: ${error.message}`);
}

/**
 * Pick the highest-priority active key for a provider.
 * Returns the row WITH plaintext key — server-only callers must treat
 * the value as sensitive.
 */
export async function pickActiveKey(
  uid: string,
  provider: ApiKeyProvider,
): Promise<{ row: UserApiKeyRow; plaintext: string } | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .eq("user_id", uid)
    .eq("provider", provider)
    .eq("status", "active")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`[api-key-manager] pickActiveKey: ${error.message}`);
  if (!data) return null;
  const row = data as UserApiKeyRow;
  try {
    const plaintext = decryptKey(row.encrypted_key);
    return { row, plaintext };
  } catch (err) {
    // Decryption failed — treat as invalid so we don't keep retrying it.
    await markKey(uid, row.id, { status: "invalid", reason: "Decryption failed" });
    return null;
  }
}

/** Used by /complete + /proxy to retrieve a specific key by id (after ticket validation). */
export async function getKeyWithPlaintext(
  uid: string,
  id: string,
): Promise<{ row: UserApiKeyRow; plaintext: string } | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from(TABLE).select("*").eq("id", id).eq("user_id", uid).maybeSingle();
  if (!data) return null;
  const row = data as UserApiKeyRow;
  try {
    return { row, plaintext: decryptKey(row.encrypted_key) };
  } catch {
    return null;
  }
}

export async function markKey(
  uid: string,
  id: string,
  opts: { status?: ApiKeyStatus; reason?: string; lastError?: string },
): Promise<void> {
  const sb = getSupabaseAdmin();
  const patch: Record<string, unknown> = {};
  if (opts.status) patch.status = opts.status;
  if (opts.status === "exhausted" || opts.status === "invalid") {
    patch.exhausted_at = new Date().toISOString();
    patch.exhausted_reason = opts.reason || null;
  }
  if (opts.lastError) patch.last_error = opts.lastError.slice(0, 500);
  if (Object.keys(patch).length === 0) return;
  await sb.from(TABLE).update(patch).eq("id", id).eq("user_id", uid);
}

export async function recordUsage(
  uid: string,
  id: string,
  bytes: number,
): Promise<void> {
  const sb = getSupabaseAdmin();
  // Read-modify-write — small concurrent races are acceptable for stats.
  const { data } = await sb.from(TABLE).select("uploads_count, bytes_uploaded").eq("id", id).eq("user_id", uid).maybeSingle();
  const cur = data as { uploads_count?: number; bytes_uploaded?: number } | null;
  const uploads = (cur?.uploads_count || 0) + 1;
  const total = (cur?.bytes_uploaded || 0) + (bytes > 0 ? bytes : 0);
  await sb
    .from(TABLE)
    .update({
      uploads_count: uploads,
      bytes_uploaded: total,
      last_used_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", id)
    .eq("user_id", uid);
}
