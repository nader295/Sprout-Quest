-- ══════════════════════════════════════════════════════════════════
--  005_upload_v2_fields.sql
--  أعمدة جديدة لصفحة الرفع المحدّثة (Upload Page v2)
--  شغّل هذا في: Supabase Dashboard → SQL Editor → New Query
--  ✅ كل سطر آمن (IF NOT EXISTS)
--  📅 2026-03-26
-- ══════════════════════════════════════════════════════════════════

-- ── Kernel fields ─────────────────────────────────────
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS kernel_type       TEXT  DEFAULT '';
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS anykernel_targets TEXT  DEFAULT '';

-- ── Module fields ─────────────────────────────────────
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS module_scope      TEXT  DEFAULT '';
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS module_managers   JSONB DEFAULT '["any"]'::jsonb;
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS soc_family        TEXT  DEFAULT '';

-- ── GSI fields ────────────────────────────────────────
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS treble_type       TEXT  DEFAULT '';
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS gsi_arch          TEXT  DEFAULT '';
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS gsi_type          TEXT  DEFAULT '';

-- ── Extended / Community fields ───────────────────────
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS xda_url           TEXT  DEFAULT '';
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS telegram_url      TEXT  DEFAULT '';
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS source_url        TEXT  DEFAULT '';
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS known_issues      TEXT  DEFAULT '';
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS min_ram           TEXT  DEFAULT '';
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS min_storage       TEXT  DEFAULT '';

-- ── Done ──────────────────────────────────────────────
DO $$ BEGIN
  RAISE NOTICE '✅ 005_upload_v2_fields: 14 columns added to roms table';
END $$;
