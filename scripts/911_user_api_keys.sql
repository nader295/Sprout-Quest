-- ════════════════════════════════════════════════════════════════════
--  RomX — Per-user upload provider API keys
--  Migration 911 — idempotent
--
--  Lets developers register their own API keys for upload providers
--  (Pixeldrain to start) so they can host ROM files through the site.
--  Keys are stored encrypted (AES-256-GCM) and rotated automatically
--  when one runs out of quota.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_api_keys (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id         TEXT NOT NULL,                       -- Firebase UID
  provider        TEXT NOT NULL,                       -- 'pixeldrain' | future: 'gofile' | 'buzzheavier'
  label           TEXT NOT NULL DEFAULT '',            -- user-friendly nickname
  -- encrypted payload (base64) — NEVER store plaintext keys
  encrypted_key   TEXT NOT NULL,
  -- last 4 chars of the plaintext key, kept for the UI fingerprint pill
  fingerprint     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'exhausted', 'invalid', 'disabled')),
  priority        INTEGER NOT NULL DEFAULT 0,          -- higher first
  -- rotation hints
  exhausted_at    TIMESTAMPTZ,
  exhausted_reason TEXT,
  -- usage stats (server-side increments only)
  uploads_count   INTEGER NOT NULL DEFAULT 0,
  bytes_uploaded  BIGINT NOT NULL DEFAULT 0,
  last_used_at    TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A user picks the next key for a provider by status+priority+created_at,
-- so that ordering is the hot path.
CREATE INDEX IF NOT EXISTS idx_user_api_keys_lookup
  ON public.user_api_keys (user_id, provider, status, priority DESC, created_at);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user
  ON public.user_api_keys (user_id, created_at DESC);

-- Service-role key bypasses RLS, but enable RLS so direct anon access is denied.
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_api_keys_no_anon" ON public.user_api_keys;
CREATE POLICY "user_api_keys_no_anon" ON public.user_api_keys
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_user_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_api_keys_updated_at ON public.user_api_keys;
CREATE TRIGGER trg_user_api_keys_updated_at
  BEFORE UPDATE ON public.user_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_user_api_keys_updated_at();
