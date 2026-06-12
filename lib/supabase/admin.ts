/**
 * lib/supabase/admin.ts — Supabase Server Client
 *
 * للاستخدام في API Routes و Server Components فقط.
 * يستخدم SERVICE_ROLE_KEY — لا تكشفه للـ client أبداً.
 *
 * متطلبات البيئة:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import type { SupabaseClient } from "@supabase/supabase-js";

let _adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_adminClient) return _adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("[Supabase Admin] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require("@supabase/supabase-js");
    _adminClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }) as SupabaseClient;
  } catch {
    throw new Error("[Supabase Admin] Run: npm install @supabase/supabase-js");
  }

  return _adminClient!;
}

/** Shorthand للاستخدام في API routes */
export const sbAdmin = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    return getSupabaseAdmin()[prop as keyof SupabaseClient];
  },
});
