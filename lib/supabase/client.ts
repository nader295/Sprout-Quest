/**
 * lib/supabase/client.ts — Supabase Browser Client
 *
 * للاستخدام في Client Components فقط.
 * متطلبات البيئة:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

let _client: SupabaseClient | null = null;

interface SupabaseClient {
  from: (table: string) => QueryBuilder;
  storage: StorageClient;
  rpc: (fn: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

interface QueryBuilder {
  select: (cols?: string) => QueryBuilder;
  insert: (data: unknown) => QueryBuilder;
  update: (data: unknown) => QueryBuilder;
  delete: () => QueryBuilder;
  upsert: (data: unknown, opts?: Record<string, unknown>) => QueryBuilder;
  eq:     (col: string, val: unknown) => QueryBuilder;
  neq:    (col: string, val: unknown) => QueryBuilder;
  in:     (col: string, vals: unknown[]) => QueryBuilder;
  ilike:  (col: string, pattern: string) => QueryBuilder;
  or:     (filter: string) => QueryBuilder;
  textSearch: (col: string, query: string, opts?: Record<string, unknown>) => QueryBuilder;
  order:  (col: string, opts?: { ascending?: boolean }) => QueryBuilder;
  limit:  (n: number) => QueryBuilder;
  range:  (from: number, to: number) => QueryBuilder;
  single: () => Promise<{ data: unknown; error: unknown }>;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  then:   (resolve: (val: { data: unknown[]; error: unknown; count?: number }) => void) => Promise<void>;
}

interface StorageClient {
  from: (bucket: string) => StorageBucketClient;
}

interface StorageBucketClient {
  upload:        (path: string, file: File | Blob, opts?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  remove:        (paths: string[]) => Promise<{ data: unknown; error: unknown }>;
  getPublicUrl:  (path: string) => { data: { publicUrl: string } };
  createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: { signedUrl: string } | null; error: unknown }>;
}

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("[Supabase] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  }

  // Lightweight client بدون @supabase/supabase-js
  // (أضف npm install @supabase/supabase-js لو عايز الـ full client)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require("@supabase/supabase-js");
    _client = createClient(url, key, {
      auth: { persistSession: false },
    }) as SupabaseClient;
  } catch {
    throw new Error("[Supabase] Run: npm install @supabase/supabase-js");
  }

  return _client!;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabaseClient()[prop as keyof SupabaseClient];
  },
});
