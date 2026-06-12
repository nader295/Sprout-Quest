-- Migration: add_anon_likes_dedup
-- Purpose: Enables anonymous (non-logged-in) likes tracked by IP fingerprint.
--          Prevents double-counting while allowing users without accounts to like ROMs.
--
-- Run this in your Supabase SQL editor before deploying the updated backend.

CREATE TABLE IF NOT EXISTS anon_likes_dedup (
  id          TEXT PRIMARY KEY,        -- format: anon_{hashedIp}_{romId}
  rom_id      TEXT NOT NULL REFERENCES roms(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups when checking existing anonymous likes
CREATE INDEX IF NOT EXISTS idx_anon_likes_dedup_rom_id ON anon_likes_dedup(rom_id);

-- Auto-cleanup: remove anonymous likes older than 90 days to prevent table bloat.
-- Anonymous likes intentionally expire; authenticated likes in `likes` table do not.
-- You can schedule this via Supabase cron (pg_cron) or your existing cron route.
--
-- Example pg_cron job (run once, requires pg_cron extension):
--   SELECT cron.schedule('cleanup-anon-likes', '0 3 * * *',
--     $$DELETE FROM anon_likes_dedup WHERE created_at < NOW() - INTERVAL '90 days'$$);

-- Row Level Security: allow the service-role (used by sbAdmin) full access.
ALTER TABLE anon_likes_dedup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON anon_likes_dedup
  FOR ALL USING (auth.role() = 'service_role');
