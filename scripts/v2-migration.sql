-- ============================================================
-- RomX v2 — SQL Migration
-- شغّل ده في Supabase SQL Editor قبل الـ deploy
-- ============================================================

-- ① أعمدة الصور الجديدة في devices
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS image_source      text,
  ADD COLUMN IF NOT EXISTS image_verified_at timestamptz;

-- ② جدول search_analytics — تسجيل كل suggest request
CREATE TABLE IF NOT EXISTS search_analytics (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  query             text          NOT NULL,
  input_codename    text          DEFAULT '',
  resolved_codename text,
  confidence        numeric(4,2)  DEFAULT 0,
  phase_used        text,         -- exact / alias / typo / consensus / fuzzy / none
  is_new_device     boolean       DEFAULT false,
  created_at        timestamptz   DEFAULT now()
);

-- Index للاستعلامات التحليلية
CREATE INDEX IF NOT EXISTS search_analytics_query_idx
  ON search_analytics (query);

CREATE INDEX IF NOT EXISTS search_analytics_created_idx
  ON search_analytics (created_at DESC);

-- حذف تلقائي بعد 90 يوم (ما نملاش الـ DB)
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM search_analytics WHERE created_at < now() - interval '90 days';
$$;

-- ③ جدول archive_reports — بلاغات تصحيح الأرشيف
-- (Firebase Firestore بيتخزن جوه admin_db، لكن لو حبيت تحول لـ Supabase)
-- هذا الجدول اختياري لو شايل الـ archive_reports في Firestore

-- ④ Unique constraint على codename
ALTER TABLE devices
  DROP CONSTRAINT IF EXISTS devices_codename_key;
ALTER TABLE devices
  ADD CONSTRAINT devices_codename_unique UNIQUE (codename);

-- ⑤ GIN Index للبحث النصي السريع (الاقتراح 7)
-- يحتاج pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS devices_name_trgm_idx
  ON devices USING gin (display_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS devices_codename_trgm_idx
  ON devices USING gin (codename gin_trgm_ops);

-- ⑥ RPC Function للـ transaction الآمن في wrong_codename correction
CREATE OR REPLACE FUNCTION transfer_device_codename(
  p_old_codename text,
  p_new_codename text,
  p_aliases      text[]
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  -- نقل كل الـ ROMs للكودنيم الجديد
  UPDATE roms
    SET device_codename = p_new_codename,
        updated_at      = now()
  WHERE device_codename = p_old_codename;

  -- تحديث الـ aliases في devices table
  UPDATE devices
    SET aliases    = p_aliases,
        updated_at = now()
  WHERE codename = p_new_codename;

  -- إذا الجهاز القديم مش عنده ROMs خلاص → ممكن تحذفه (اختياري)
  -- DELETE FROM devices WHERE codename = p_old_codename
  --   AND NOT EXISTS (SELECT 1 FROM roms WHERE device_codename = p_old_codename);
END;
$$;

-- ⑦ Index على device_codename_votes للـ consensus queries
CREATE INDEX IF NOT EXISTS votes_device_name_idx
  ON device_codename_votes (device_name);

CREATE INDEX IF NOT EXISTS votes_codename_idx
  ON device_codename_votes (codename);

-- ⑧ Column للـ rom_count في devices (بيساعد الـ popularity boost)
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS rom_count integer DEFAULT 0;

-- Function لتحديث rom_count تلقائياً
CREATE OR REPLACE FUNCTION update_device_rom_count(p_codename text)
RETURNS void LANGUAGE sql AS $$
  UPDATE devices
    SET rom_count  = (SELECT count(*) FROM roms WHERE device_codename = p_codename),
        updated_at = now()
  WHERE codename = p_codename;
$$;

-- ============================================================
-- تحقق من النتيجة
-- ============================================================
SELECT
  (SELECT count(*) FROM devices)           AS total_devices,
  (SELECT count(*) FROM roms)              AS total_roms,
  (SELECT count(*) FROM search_analytics)  AS analytics_rows,
  pg_size_pretty(pg_total_relation_size('devices')) AS devices_size;
