-- ═══════════════════════════════════════════════════════════════
--  RomX — Supabase Schema
--  انسخ هذا الملف وشغّله في Supabase SQL Editor
--  https://supabase.com/dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- للبحث السريع

-- ═══════════════════════════════════════════════════════════════
--  USERS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.users (
  id              TEXT PRIMARY KEY,   -- Firebase UID
  name            TEXT NOT NULL DEFAULT '',
  username        TEXT UNIQUE,
  email           TEXT,
  photo           TEXT DEFAULT '',
  cover_photo     TEXT DEFAULT '',    -- صورة الغلاف (Supabase Storage)
  bio             TEXT DEFAULT '',
  role            TEXT NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user','verifiedDev','admin','moderator','banned')),
  xp              INTEGER NOT NULL DEFAULT 0,
  level           INTEGER NOT NULL DEFAULT 1,
  roms_count      INTEGER NOT NULL DEFAULT 0,
  followers_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  downloads_total INTEGER NOT NULL DEFAULT 0,
  likes_received  INTEGER NOT NULL DEFAULT 0,
  country         TEXT DEFAULT '',
  website         TEXT DEFAULT '',
  telegram        TEXT DEFAULT '',
  github          TEXT DEFAULT '',
  donation_links  JSONB DEFAULT '[]',
  badges          TEXT[] DEFAULT '{}',
  is_suspended    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- User specific stats
  total_views_received INTEGER NOT NULL DEFAULT 0,
  total_supports_received INTEGER NOT NULL DEFAULT 0,
  total_ad_supports INTEGER NOT NULL DEFAULT 0,
  ad_support_earnings NUMERIC NOT NULL DEFAULT 0,
  ad_support_points INTEGER NOT NULL DEFAULT 0,

  -- Full-text search vector (اللي بيغني عن Algolia للمستخدمين)
  search_vector   TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(username,'') || ' ' || coalesce(bio,''))
  ) STORED
);

-- ═══════════════════════════════════════════════════════════════
--  ROMS (الجدول الرئيسي — معظم القراءات هنا)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.roms (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name                TEXT NOT NULL,
  content_type        TEXT NOT NULL DEFAULT 'rom'
                      CHECK (content_type IN ('rom','kernel','recovery','module','gsi')),
  brand               TEXT DEFAULT '',
  device              TEXT DEFAULT '',
  android             TEXT DEFAULT '',
  version             TEXT DEFAULT '',
  size                TEXT DEFAULT '',
  description         TEXT DEFAULT '',
  changelog           TEXT DEFAULT '',
  download_url        TEXT DEFAULT '',
  mirror_url          TEXT DEFAULT '',
  thumbnail           TEXT DEFAULT '',   -- Cloudinary URL
  screenshots         TEXT[] DEFAULT '{}', -- Cloudinary URLs
  tags                TEXT[] DEFAULT '{}',
  rom_status          TEXT DEFAULT 'active'
                      CHECK (rom_status IN ('active','discontinued','beta','testing')),
  rom_type            TEXT DEFAULT '',
  install_guide       TEXT DEFAULT '',
  checksum_md5        TEXT DEFAULT '',
  checksum_sha256     TEXT DEFAULT '',
  kernel_version      TEXT DEFAULT '',
  recovery_type       TEXT DEFAULT '',
  module_id           TEXT DEFAULT '',
  min_magisk          TEXT DEFAULT '',
  module_manager      TEXT DEFAULT '',
  compatible_devices  TEXT[] DEFAULT '{}',
  mirrors             JSONB DEFAULT '[]',
  variants            JSONB DEFAULT '[]'::jsonb,

  -- Stats
  downloads           INTEGER NOT NULL DEFAULT 0,
  total_views         INTEGER NOT NULL DEFAULT 0,
  likes_count         INTEGER NOT NULL DEFAULT 0,
  rating_count        INTEGER NOT NULL DEFAULT 0,
  rating_sum          NUMERIC NOT NULL DEFAULT 0,
  rating_avg          NUMERIC NOT NULL DEFAULT 0,
  trend_score         INTEGER NOT NULL DEFAULT 0,
  comments_count      INTEGER NOT NULL DEFAULT 0,
  support_count       INTEGER NOT NULL DEFAULT 0,

  -- Maintainer (مرتبط بـ Firebase UID)
  maintainer_uid      TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  maintainer_name     TEXT DEFAULT '',
  maintainer_photo    TEXT DEFAULT '',

  -- Flags
  featured            BOOLEAN NOT NULL DEFAULT FALSE,
  milestone_100_awarded  BOOLEAN DEFAULT FALSE,
  milestone_500_awarded  BOOLEAN DEFAULT FALSE,
  milestone_1000_awarded BOOLEAN DEFAULT FALSE,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Full-text search vector — يغني عن Algolia بالكامل
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(name,'')        || ' ' ||
      coalesce(brand,'')       || ' ' ||
      coalesce(device,'')      || ' ' ||
      coalesce(android,'')     || ' ' ||
      coalesce(description,'') || ' ' ||
      coalesce(maintainer_name,'') || ' ' ||
      coalesce(array_to_string(tags, ' '),'') || ' ' ||
      coalesce(array_to_string(compatible_devices, ' '),'')
    )
  ) STORED
);

-- ═══════════════════════════════════════════════════════════════
--  COMMENTS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rom_id      TEXT NOT NULL REFERENCES public.roms(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name   TEXT DEFAULT '',
  user_photo  TEXT DEFAULT '',
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  likes_count INTEGER NOT NULL DEFAULT 0,
  parent_id   UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
--  LIKES
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.likes (
  rom_id      TEXT NOT NULL REFERENCES public.roms(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rom_id, user_id)
);

-- ═══════════════════════════════════════════════════════════════
--  RATINGS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ratings (
  rom_id      TEXT NOT NULL REFERENCES public.roms(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score       SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rom_id, user_id)
);

-- ═══════════════════════════════════════════════════════════════
--  DOWNLOADS (dedup — منع عد نفس المستخدم مرتين)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.downloads_dedup (
  id          TEXT PRIMARY KEY, -- "{user_id|ip_hash}_{rom_id}"
  rom_id      TEXT NOT NULL,
  last_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
--  VIEWS DEDUP
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.views_dedup (
  id          TEXT PRIMARY KEY, -- "{ip_hash}_{rom_id}"
  rom_id      TEXT NOT NULL,
  last_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
--  COLLECTIONS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_public   BOOLEAN NOT NULL DEFAULT TRUE,
  rom_ids     TEXT[] DEFAULT '{}',
  cover_url   TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
--  FOLLOWS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id   TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id  TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- ═══════════════════════════════════════════════════════════════
--  DEVICES
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.devices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codename    TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  brand       TEXT NOT NULL,
  android     TEXT DEFAULT '',
  image_url   TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
--  INDEXES — للسرعة القصوى
-- ═══════════════════════════════════════════════════════════════

-- ROMS
CREATE INDEX IF NOT EXISTS roms_search_idx      ON public.roms USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS roms_type_idx        ON public.roms (content_type);
CREATE INDEX IF NOT EXISTS roms_brand_idx       ON public.roms (brand);
CREATE INDEX IF NOT EXISTS roms_android_idx     ON public.roms (android);
CREATE INDEX IF NOT EXISTS roms_maintainer_idx  ON public.roms (maintainer_uid);
CREATE INDEX IF NOT EXISTS roms_featured_idx    ON public.roms (featured) WHERE featured = TRUE;
CREATE INDEX IF NOT EXISTS roms_created_idx     ON public.roms (created_at DESC);
CREATE INDEX IF NOT EXISTS roms_downloads_idx   ON public.roms (downloads DESC);
CREATE INDEX IF NOT EXISTS roms_likes_idx       ON public.roms (likes_count DESC);
CREATE INDEX IF NOT EXISTS roms_trend_idx       ON public.roms (trend_score DESC);
CREATE INDEX IF NOT EXISTS roms_tags_idx        ON public.roms USING GIN (tags);
CREATE INDEX IF NOT EXISTS roms_devices_idx     ON public.roms USING GIN (compatible_devices);
-- Composite للفلترة المتعددة (الأكثر استخداماً)
CREATE INDEX IF NOT EXISTS roms_type_created_idx ON public.roms (content_type, created_at DESC);
CREATE INDEX IF NOT EXISTS roms_brand_created_idx ON public.roms (brand, created_at DESC);

-- USERS
CREATE INDEX IF NOT EXISTS users_search_idx     ON public.users USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS users_username_idx   ON public.users (username);
CREATE INDEX IF NOT EXISTS users_xp_idx         ON public.users (xp DESC);
CREATE INDEX IF NOT EXISTS users_role_idx       ON public.users (role);

-- COMMENTS
CREATE INDEX IF NOT EXISTS comments_rom_idx     ON public.comments (rom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_user_idx    ON public.comments (user_id);

-- LIKES
CREATE INDEX IF NOT EXISTS likes_user_idx       ON public.likes (user_id);

-- DEDUP
CREATE INDEX IF NOT EXISTS downloads_dedup_rom_idx ON public.downloads_dedup (rom_id);
CREATE INDEX IF NOT EXISTS views_dedup_rom_idx     ON public.views_dedup (rom_id);

-- ═══════════════════════════════════════════════════════════════
--  FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- دالة البحث الشاملة (ROMs + Users)
CREATE OR REPLACE FUNCTION search_roms(
  query TEXT,
  p_content_type TEXT DEFAULT NULL,
  p_brand TEXT DEFAULT NULL,
  p_android TEXT DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 24,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF public.roms
LANGUAGE sql STABLE AS $$
  SELECT *
  FROM   public.roms
  WHERE  (query = '' OR search_vector @@ websearch_to_tsquery('simple', query))
    AND  (p_content_type IS NULL OR content_type = p_content_type)
    AND  (p_brand        IS NULL OR brand        = p_brand)
    AND  (p_android      IS NULL OR android      = p_android)
    AND  (p_device       IS NULL OR device ILIKE '%' || p_device || '%'
          OR p_device = ANY(compatible_devices))
  ORDER BY
    CASE WHEN query != '' THEN ts_rank(search_vector, websearch_to_tsquery('simple', query)) END DESC NULLS LAST,
    trend_score DESC,
    created_at  DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

-- دالة تحديث trend_score (تُستدعى بـ cron job)
CREATE OR REPLACE FUNCTION decay_trend_scores()
RETURNS void LANGUAGE sql AS $$
  UPDATE public.roms
  SET    trend_score = GREATEST(0, trend_score - 5)
  WHERE  trend_score > 0;
$$;

-- ═══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.roms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows     ENABLE ROW LEVEL SECURITY;

-- القراءة العامة للرومات والمستخدمين (بدون تسجيل دخول)
CREATE POLICY "roms_public_read"  ON public.roms    FOR SELECT USING (TRUE);
CREATE POLICY "users_public_read" ON public.users   FOR SELECT USING (TRUE);
CREATE POLICY "comments_public_read" ON public.comments FOR SELECT USING (NOT is_deleted);
CREATE POLICY "collections_public_read" ON public.collections FOR SELECT USING (is_public);
CREATE POLICY "likes_public_read" ON public.likes   FOR SELECT USING (TRUE);
CREATE POLICY "follows_public_read" ON public.follows FOR SELECT USING (TRUE);
CREATE POLICY "ratings_public_read" ON public.ratings FOR SELECT USING (TRUE);

-- الكتابة عن طريق API Routes فقط (service role key)
-- الـ service role key يتجاوز RLS تلقائياً
-- لا تحتاج policies إضافية للـ INSERT/UPDATE/DELETE

-- ═══════════════════════════════════════════════════════════════
--  STORAGE BUCKETS
-- ═══════════════════════════════════════════════════════════════
-- شغّل هذا في Dashboard → Storage → New Bucket
-- أو عن طريق Supabase Dashboard مباشرة

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('avatars', 'avatars', true);

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('covers', 'covers', true);

-- ═══════════════════════════════════════════════════════════════
--  STORAGE POLICIES
-- ═══════════════════════════════════════════════════════════════
-- CREATE POLICY "avatars_public_read"
--   ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- CREATE POLICY "covers_public_read"
--   ON storage.objects FOR SELECT USING (bucket_id = 'covers');

-- ═══════════════════════════════════════════════════════════════
--  ROM DAILY STATS (for real Analytics)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.rom_daily_stats (
  rom_id        TEXT NOT NULL REFERENCES public.roms(id) ON DELETE CASCADE,
  maintainer_uid TEXT NOT NULL,
  stat_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  views         INTEGER NOT NULL DEFAULT 0,
  downloads     INTEGER NOT NULL DEFAULT 0,
  likes         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (rom_id, stat_date)
);
CREATE INDEX IF NOT EXISTS rds_maintainer_date_idx ON public.rom_daily_stats (maintainer_uid, stat_date DESC);

-- دالة لتجميع الإحصاء اليومي (increment atomically)
CREATE OR REPLACE FUNCTION increment_daily_stat(
  p_rom_id TEXT,
  p_maintainer_uid TEXT,
  p_stat_date DATE,
  p_views INTEGER DEFAULT 0,
  p_downloads INTEGER DEFAULT 0
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.rom_daily_stats (rom_id, maintainer_uid, stat_date, views, downloads)
  VALUES (p_rom_id, p_maintainer_uid, p_stat_date, p_views, p_downloads)
  ON CONFLICT (rom_id, stat_date)
  DO UPDATE SET
    views     = rom_daily_stats.views     + EXCLUDED.views,
    downloads = rom_daily_stats.downloads + EXCLUDED.downloads;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
--  ROM HEALTH SCORE
--  نقاط صحة ROM مبنية على: Downloads + Likes + Rating + Update Frequency
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_rom_health_score(
  p_downloads     INTEGER,
  p_likes         INTEGER,
  p_rating_avg    NUMERIC,
  p_rating_count  INTEGER,
  p_created_at    TIMESTAMPTZ,
  p_updated_at    TIMESTAMPTZ
) RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_download_score  INTEGER;
  v_like_score      INTEGER;
  v_rating_score    INTEGER;
  v_freshness_score INTEGER;
  v_days_old        INTEGER;
  v_days_since_update INTEGER;
BEGIN
  -- Download score (max 30)
  v_download_score := LEAST(30, FLOOR(LOG(GREATEST(p_downloads, 1) + 1) * 5)::INTEGER);

  -- Like score (max 25)
  v_like_score := LEAST(25, FLOOR(LOG(GREATEST(p_likes, 1) + 1) * 5)::INTEGER);

  -- Rating score (max 25) — needs at least 3 ratings to count
  IF p_rating_count >= 3 THEN
    v_rating_score := FLOOR((p_rating_avg / 5.0) * 25)::INTEGER;
  ELSE
    v_rating_score := 0;
  END IF;

  -- Freshness score (max 20) — penalise stale ROMs
  v_days_old := EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 86400;
  v_days_since_update := EXTRACT(EPOCH FROM (NOW() - COALESCE(p_updated_at, p_created_at))) / 86400;

  IF v_days_since_update <= 30 THEN
    v_freshness_score := 20;
  ELSIF v_days_since_update <= 90 THEN
    v_freshness_score := 15;
  ELSIF v_days_since_update <= 180 THEN
    v_freshness_score := 8;
  ELSE
    v_freshness_score := 2;
  END IF;

  RETURN GREATEST(0, LEAST(100,
    v_download_score + v_like_score + v_rating_score + v_freshness_score
  ));
END;
$$;

-- إضافة health_score كـ generated column (مُحسَّب تلقائياً)
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS
  health_score INTEGER GENERATED ALWAYS AS (
    get_rom_health_score(downloads, likes_count, rating_avg, rating_count, created_at, updated_at)
  ) STORED;

-- ═══════════════════════════════════════════════════════════════
--  DEVICE CODENAME — عمود لتطبيع اسم الجهاز
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS
  device_codename TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS roms_device_codename_idx
  ON public.roms (device_codename)
  WHERE device_codename != '';

-- ═══════════════════════════════════════════════════════════════
--  DEVICE CODENAME BACKFILL (شغّلها مرة واحدة بس)
--  تحدّث كل الـ ROMs الموجودة وتملي الـ device_codename
--  Note: ده هيتعمل من API endpoint /api/admin/backfill-devices
-- ═══════════════════════════════════════════════════════════════
-- بعد ما تشغّل السكيما، نفّذ من Next.js:
--   POST /api/admin/backfill-devices
-- ده هيطبّع كل الـ ROMs الموجودة تلقائياً

-- ═══════════════════════════════════════════════════════════════
--  ROM VERSIONS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.rom_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rom_id TEXT NOT NULL REFERENCES public.roms(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  android TEXT DEFAULT '',
  changelog TEXT DEFAULT '',
  download_url TEXT DEFAULT '',
  size TEXT DEFAULT '',
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rom_versions_rom_id_idx ON public.rom_versions(rom_id, created_at DESC);

ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS version_count INTEGER NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION increment_rom_version_count(p_rom_id TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.roms
  SET version_count = version_count + 1
  WHERE id = p_rom_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_user_views_received(p_user_id TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.users
  SET total_views_received = total_views_received + 1
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_user_supports_received(p_user_id TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.users
  SET total_supports_received = total_supports_received + 1
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_viewer_ad_points(p_viewer_uid TEXT, p_points INTEGER)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.users 
  SET ad_support_points = ad_support_points + p_points 
  WHERE id = p_viewer_uid;
END;
$$;

CREATE OR REPLACE FUNCTION record_ad_support_earnings(p_dev_uid TEXT, p_earnings NUMERIC)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.users
  SET total_ad_supports = total_ad_supports + 1,
      ad_support_earnings = ad_support_earnings + p_earnings,
      total_supports_received = total_supports_received + 1
  WHERE id = p_dev_uid;
END;
$$;
