-- ══════════════════════════════════════════════════════════════════════
-- Migration 002: Device Consensus System
-- شغّل في Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════════════

-- ── جدول الأجهزة الموحّدة (السجل الرسمي) ────────────────────────────
CREATE TABLE IF NOT EXISTS device_registry (
  codename        TEXT PRIMARY KEY,           -- "rodin"
  display_name    TEXT NOT NULL,              -- "Poco X7 Pro"
  brand           TEXT NOT NULL DEFAULT '',
  chipset         TEXT DEFAULT '',
  released        TEXT DEFAULT '',
  image_url       TEXT DEFAULT '',
  vote_count      INTEGER NOT NULL DEFAULT 0, -- عدد المطورين اللي كتبوا هذا الكودنيم
  rom_count       INTEGER NOT NULL DEFAULT 0, -- عدد الـ ROMs المرتبطة
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── جدول تصويتات الكودنيم (كل ROM بيصوت) ────────────────────────────
-- لو مطور رفع "rodin" لجهاز "Poco X7 Pro" → سجّل صوت
-- لو مطور آخر رفع "shiva" لنفس الجهاز → صوت تاني (مختلف)
-- الـ codename اللي عنده أكثر أصوات هو الفائز
CREATE TABLE IF NOT EXISTS device_codename_votes (
  id              BIGSERIAL PRIMARY KEY,
  device_name     TEXT NOT NULL,              -- "Poco X7 Pro" (اسم الجهاز)
  brand           TEXT NOT NULL DEFAULT '',
  codename        TEXT NOT NULL,              -- الكودنيم اللي كتبه المطور
  rom_id          TEXT NOT NULL,              -- id الـ ROM في جدول roms
  maintainer_uid  TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rom_id)  -- كل ROM يصوت مرة واحدة بس
);

-- ── دالة consensus: تحسب الكودنيم الفائز لجهاز معين ─────────────────
-- Input: device_name مثل "Poco X7 Pro", brand مثل "Xiaomi"
-- Output: الكودنيم الأكثر تكراراً
CREATE OR REPLACE FUNCTION get_consensus_codename(
  p_device_name TEXT,
  p_brand TEXT DEFAULT ''
)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT codename
  FROM device_codename_votes
  WHERE LOWER(TRIM(device_name)) = LOWER(TRIM(p_device_name))
    AND (p_brand = '' OR LOWER(brand) = LOWER(p_brand))
  GROUP BY codename
  ORDER BY COUNT(*) DESC, MIN(created_at) ASC
  LIMIT 1;
$$;

-- ── دالة مدمجة: تحسب كل الـ codenames الغلط وتصلحها ─────────────────
CREATE OR REPLACE FUNCTION resolve_device_codename(
  p_device_name TEXT,
  p_brand TEXT DEFAULT '',
  p_input_codename TEXT DEFAULT ''
)
RETURNS TABLE(
  winner_codename TEXT,
  total_votes     BIGINT,
  winner_votes    BIGINT,
  confidence      NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH votes AS (
    SELECT
      codename,
      COUNT(*) AS cnt
    FROM device_codename_votes
    WHERE LOWER(TRIM(device_name)) = LOWER(TRIM(p_device_name))
      AND (p_brand = '' OR LOWER(brand) = LOWER(p_brand))
    GROUP BY codename
  ),
  totals AS (
    SELECT SUM(cnt) AS total FROM votes
  )
  SELECT
    v.codename            AS winner_codename,
    t.total               AS total_votes,
    v.cnt                 AS winner_votes,
    ROUND(v.cnt::NUMERIC / NULLIF(t.total, 0) * 100, 1) AS confidence
  FROM votes v, totals t
  ORDER BY v.cnt DESC, v.codename ASC
  LIMIT 1;
$$;

-- ── Index للأداء ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_votes_device_name
  ON device_codename_votes (LOWER(device_name));

CREATE INDEX IF NOT EXISTS idx_votes_codename
  ON device_codename_votes (codename);

CREATE INDEX IF NOT EXISTS idx_votes_rom_id
  ON device_codename_votes (rom_id);

CREATE INDEX IF NOT EXISTS idx_registry_brand
  ON device_registry (brand);

-- ── Trigger: تحديث updated_at تلقائياً ──────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_registry_updated_at
  BEFORE UPDATE ON device_registry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── تأكد من صحة البنية ───────────────────────────────────────────────
SELECT
  'device_registry' AS table_name,
  COUNT(*) AS rows
FROM device_registry
UNION ALL
SELECT
  'device_codename_votes',
  COUNT(*)
FROM device_codename_votes;
