-- Migration 004: Add support_count to roms table
-- Run this on your existing Supabase database

ALTER TABLE public.roms
  ADD COLUMN IF NOT EXISTS support_count INTEGER NOT NULL DEFAULT 0;

-- Index for potential sorting by support
CREATE INDEX IF NOT EXISTS roms_support_idx ON public.roms (support_count DESC);

COMMENT ON COLUMN public.roms.support_count IS 'Number of times users supported this ROM via the Support Developer button';
