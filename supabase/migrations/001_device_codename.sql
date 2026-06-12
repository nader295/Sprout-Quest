-- ══════════════════════════════════════════════════════════════════════
-- Migration: device_codename column + backfill
-- شغّل في Supabase → SQL Editor → Run مرة واحدة بس
-- ══════════════════════════════════════════════════════════════════════

-- ── Step 1: أضف العمود لو مش موجود ──────────────────────────────────
ALTER TABLE roms
  ADD COLUMN IF NOT EXISTS device_codename TEXT NOT NULL DEFAULT '';

-- ── Step 2: Index للأداء ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_roms_device_codename
  ON roms (device_codename);

-- ── Step 3: Backfill الـ ROMs القديمة ────────────────────────────────
-- بيحول اسم الجهاز → codename تلقائياً
-- مثال: "Poco X7 Pro" → "poco_x7_pro"
-- ملاحظة: الـ codenames دي مش دايماً هي الرسمية (مثلاً "rodin")
-- لكنها أفضل من ترك العمود فاضي — المطورين الجدد بيدخلوا الكودنيم الصح بأنفسهم

UPDATE roms
SET device_codename = TRIM('_' FROM
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        LOWER(TRIM(device)),
        '\s+', '_', 'g'          -- مسافات → underscore
      ),
      '[^a-z0-9_\-\.]', '', 'g'  -- شيل كل حاجة غير حرف/رقم
    ),
    '_+', '_', 'g'               -- underscore متكرر → واحد
  )
)
WHERE (device_codename IS NULL OR device_codename = '')
  AND device IS NOT NULL
  AND device != '';

-- ── Step 4: تحقق من النتيجة ──────────────────────────────────────────
SELECT
  device_codename,
  COUNT(*) AS rom_count,
  MIN(device) AS sample_device
FROM roms
WHERE device_codename != ''
GROUP BY device_codename
ORDER BY rom_count DESC
LIMIT 20;
