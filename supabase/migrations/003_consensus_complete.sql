-- ══════════════════════════════════════════════════════════════════════
-- Migration 003: Complete Consensus System
-- شغّل في Supabase → SQL Editor بعد 001 و 002
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. تأكد إن جداول الـ consensus موجودة ────────────────────────────
CREATE TABLE IF NOT EXISTS device_codename_votes (
  id              BIGSERIAL PRIMARY KEY,
  device_name     TEXT        NOT NULL,
  brand           TEXT        NOT NULL DEFAULT '',
  codename        TEXT        NOT NULL,
  rom_id          TEXT        NOT NULL,
  maintainer_uid  TEXT        NOT NULL,
  confidence      NUMERIC     NOT NULL DEFAULT 1.0,  -- ثقة smartMatch (0..1)
  source          TEXT        NOT NULL DEFAULT 'manual', -- 'manual'|'smart'|'backfill'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(rom_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_device_name ON device_codename_votes (LOWER(device_name));
CREATE INDEX IF NOT EXISTS idx_votes_brand        ON device_codename_votes (LOWER(brand));
CREATE INDEX IF NOT EXISTS idx_votes_codename     ON device_codename_votes (codename);
CREATE INDEX IF NOT EXISTS idx_votes_rom_id       ON device_codename_votes (rom_id);

-- ── 2. دالة: جيب الفائز لجهاز معين (بـ fuzzy match على الاسم) ────────
CREATE OR REPLACE FUNCTION get_consensus_codename(
  p_device_name TEXT,
  p_brand       TEXT DEFAULT ''
)
RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT codename
  FROM device_codename_votes
  WHERE LOWER(TRIM(device_name)) = LOWER(TRIM(p_device_name))
    AND (p_brand = '' OR LOWER(brand) = LOWER(p_brand))
  GROUP BY codename
  ORDER BY
    SUM(confidence) DESC,   -- الأعلى ثقة مجمّعة أولاً
    COUNT(*) DESC,           -- الأكثر أصوات ثانياً
    MIN(created_at) ASC      -- الأقدم ثالثاً
  LIMIT 1;
$$;

-- ── 3. دالة: resolve مع تفاصيل كاملة ─────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_device_codename(
  p_device_name     TEXT,
  p_brand           TEXT DEFAULT '',
  p_input_codename  TEXT DEFAULT ''
)
RETURNS TABLE(
  winner_codename TEXT,
  total_votes     BIGINT,
  winner_votes    BIGINT,
  winner_confidence NUMERIC,
  all_candidates  JSON
)
LANGUAGE sql STABLE AS $$
  WITH votes AS (
    SELECT
      codename,
      COUNT(*)            AS cnt,
      SUM(confidence)     AS conf_sum,
      AVG(confidence)     AS conf_avg
    FROM device_codename_votes
    WHERE LOWER(TRIM(device_name)) = LOWER(TRIM(p_device_name))
      AND (p_brand = '' OR LOWER(brand) = LOWER(p_brand))
    GROUP BY codename
  ),
  totals AS (SELECT SUM(cnt) AS total FROM votes),
  ranked AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY conf_sum DESC, cnt DESC) AS rn
    FROM votes
  )
  SELECT
    r.codename             AS winner_codename,
    t.total                AS total_votes,
    r.cnt                  AS winner_votes,
    ROUND(r.conf_sum, 2)   AS winner_confidence,
    (
      SELECT JSON_AGG(JSON_BUILD_OBJECT(
        'codename', v.codename, 'votes', v.cnt, 'confidence', ROUND(v.conf_sum, 2)
      ) ORDER BY v.conf_sum DESC)
      FROM votes v
    )                      AS all_candidates
  FROM ranked r, totals t
  WHERE r.rn = 1;
$$;

-- ── 4. دالة: consolidate جهاز واحد (تصلح الـ ROMs الغلط) ─────────────
-- بتحسب الفائز وتحدّث كل الـ ROMs اللي عندها نفس اسم الجهاز
CREATE OR REPLACE FUNCTION consolidate_device(
  p_device_name TEXT,
  p_brand       TEXT DEFAULT ''
)
RETURNS TABLE(
  winner      TEXT,
  fixed_count BIGINT,
  skip_count  BIGINT
)
LANGUAGE plpgsql AS $$
DECLARE
  v_winner TEXT;
BEGIN
  -- جيب الفائز
  v_winner := get_consensus_codename(p_device_name, p_brand);

  IF v_winner IS NULL THEN
    -- مفيش أصوات كافية — ارجع بدون تغيير
    RETURN QUERY SELECT NULL::TEXT, 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  -- حدّث الـ ROMs اللي عندها نفس اسم الجهاز لكن كودنيم مختلف
  RETURN QUERY
  WITH updated AS (
    UPDATE roms
    SET device_codename = v_winner
    WHERE LOWER(TRIM(device)) = LOWER(TRIM(p_device_name))
      AND (p_brand = '' OR LOWER(brand) = LOWER(p_brand))
      AND device_codename != v_winner
    RETURNING id
  ),
  unchanged AS (
    SELECT id FROM roms
    WHERE LOWER(TRIM(device)) = LOWER(TRIM(p_device_name))
      AND (p_brand = '' OR LOWER(brand) = LOWER(p_brand))
      AND device_codename = v_winner
  )
  SELECT
    v_winner,
    (SELECT COUNT(*) FROM updated)   AS fixed_count,
    (SELECT COUNT(*) FROM unchanged) AS skip_count;
END;
$$;

-- ── 5. دالة: consolidate كل الأجهزة (تشتغل في الـ cron) ─────────────
CREATE OR REPLACE FUNCTION consolidate_all_devices()
RETURNS TABLE(
  device_name TEXT,
  brand       TEXT,
  winner      TEXT,
  fixed       BIGINT,
  skipped     BIGINT
)
LANGUAGE plpgsql AS $$
DECLARE
  rec RECORD;
BEGIN
  -- اجمّع كل الأجهزة الفريدة من جدول الأصوات
  FOR rec IN
    SELECT DISTINCT
      LOWER(TRIM(device_name)) AS dn,
      LOWER(TRIM(brand))       AS br
    FROM device_codename_votes
  LOOP
    RETURN QUERY
    SELECT
      rec.dn,
      rec.br,
      r.winner,
      r.fixed_count,
      r.skip_count
    FROM consolidate_device(rec.dn, rec.br) r;
  END LOOP;
END;
$$;

-- ── 6. دالة: backfill الـ votes من الـ ROMs الموجودة ──────────────────
-- شغّلها مرة واحدة عشان تحوّل الـ ROMs القديمة لأصوات
CREATE OR REPLACE FUNCTION backfill_votes_from_roms()
RETURNS TABLE(inserted BIGINT, skipped BIGINT)
LANGUAGE plpgsql AS $$
DECLARE
  v_inserted BIGINT := 0;
  v_skipped  BIGINT := 0;
BEGIN
  WITH ins AS (
    INSERT INTO device_codename_votes
      (device_name, brand, codename, rom_id, maintainer_uid, confidence, source)
    SELECT
      device,
      brand,
      device_codename,
      id,
      COALESCE(maintainer_uid, 'system'),
      0.7,   -- confidence متوسطة للبيانات القديمة
      'backfill'
    FROM roms
    WHERE device_codename != ''
      AND device_codename IS NOT NULL
      AND device != ''
      AND device IS NOT NULL
    ON CONFLICT (rom_id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM ins;

  SELECT COUNT(*) INTO v_skipped
  FROM roms
  WHERE device_codename != ''
    AND id IN (SELECT rom_id FROM device_codename_votes);

  RETURN QUERY SELECT v_inserted, v_skipped;
END;
$$;

-- ── 7. نتيجة التشغيل ─────────────────────────────────────────────────
SELECT 'Consensus system ready ✓' AS status;
