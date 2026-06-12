-- ═══════════════════════════════════════════════════════════════
-- Migration: Linkvertise Monetization System
-- Date: 2026-04-13
-- ═══════════════════════════════════════════════════════════════

-- 1. إضافة تحكم Linkvertise على مستوى كل منشور
ALTER TABLE public.roms
  ADD COLUMN IF NOT EXISTS linkvertise_enabled boolean NOT NULL DEFAULT false;

-- 2. إضافة تحكم عالمي على مستوى اليوزر + مفتاح API
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS linkvertise_global_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linkvertise_publisher_id  text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS linkvertise_earnings      numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS linkvertise_last_sync     timestamp with time zone;

-- 3. إزالة حقول نظام الإعلانات القديم (يُعلّق — لا يُحذف حتى تنتهي الهجرة)
-- ALTER TABLE public.users DROP COLUMN IF EXISTS ads_enabled;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS ad_placement;
-- ملاحظة: الأعمدة القديمة تبقى موجودة لكن مش مستخدمة في الكود الجديد

-- 4. جدول لتتبع نقرات Linkvertise لكل ROM
CREATE TABLE IF NOT EXISTS public.linkvertise_clicks (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  rom_id       text NOT NULL,
  maintainer_uid text NOT NULL,
  clicked_at   timestamp with time zone NOT NULL DEFAULT now(),
  user_uid     text,
  ip           text DEFAULT '',
  country      text DEFAULT '',
  CONSTRAINT linkvertise_clicks_pkey PRIMARY KEY (id),
  CONSTRAINT linkvertise_clicks_rom_id_fkey FOREIGN KEY (rom_id) REFERENCES public.roms(id)
);

-- 5. Index للأداء
CREATE INDEX IF NOT EXISTS idx_linkvertise_clicks_rom_id ON public.linkvertise_clicks(rom_id);
CREATE INDEX IF NOT EXISTS idx_linkvertise_clicks_maintainer ON public.linkvertise_clicks(maintainer_uid);
CREATE INDEX IF NOT EXISTS idx_roms_linkvertise_enabled ON public.roms(linkvertise_enabled) WHERE linkvertise_enabled = true;
