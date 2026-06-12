-- This migration script creates the "variants" column in the "roms" table
-- and updates the types to support AnyKernel3, GSI, and universal modules.

-- 1. Add variants column (JSONB)
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

-- 2. Add module_manager column for magisk/ksu/apatch
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS module_manager TEXT DEFAULT '';

-- 3. Make device Codename nullable for universal items
ALTER TABLE public.roms ALTER COLUMN device_codename DROP NOT NULL;

-- 4. If "device" or "brand" were strictly constrained/NOT NULL, make them nullable
ALTER TABLE public.roms ALTER COLUMN device DROP NOT NULL;
ALTER TABLE public.roms ALTER COLUMN brand DROP NOT NULL;

-- 5. Set fallback default values for universal content types
UPDATE public.roms
SET device = 'Universal', brand = 'Generic'
WHERE content_type IN ('gsi') AND (device IS NULL OR device = '');

-- (Optional) Add a comment to the table column
COMMENT ON COLUMN public.roms.variants IS 'Stores multiple download variants (e.g., Rooted, Non-Rooted, SusFS, KSU, Vanilla, GApps) as a JSON array of objects.';

-- Print success message
DO $$ BEGIN RAISE NOTICE 'Success! Added variants and module_manager to roms table.'; END $$;
