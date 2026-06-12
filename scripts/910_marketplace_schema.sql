-- ════════════════════════════════════════════════════════════════════
--  RomX — Marketplace schema (Requests / Offers + Provider Profiles)
--  Migration 910 — production grade, idempotent, applied on Supabase
--
--  Tables:
--    marketplace_provider_profiles   public profile a user opens to sell services
--    marketplace_listings             every request OR offer the user posts
--    marketplace_proposals            counter-offers and inquiries on a listing
--
--  Notes:
--    * Self-contained — no FK to public.users; owner identity is denormalised
--      onto each listing (owner_uid + owner_name + owner_avatar) so the market
--      keeps working even if the users table is migrated/renamed/missing.
--    * Service-role key bypasses RLS, so all access control is enforced inside
--      the API route handlers (matches the rest of the project).
--    * No mock or seed rows. The market starts empty and grows organically.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.marketplace_provider_profiles (
  uid               TEXT PRIMARY KEY,
  display_name      TEXT NOT NULL DEFAULT '',
  avatar_url        TEXT NOT NULL DEFAULT '',
  cover_image       TEXT,
  headline          TEXT NOT NULL DEFAULT '',
  bio               TEXT NOT NULL DEFAULT '',
  hourly_rate       NUMERIC(10, 2),
  hourly_currency   TEXT NOT NULL DEFAULT 'USD',
  response_time_h   INTEGER,
  languages         TEXT[] NOT NULL DEFAULT '{}',
  skills            TEXT[] NOT NULL DEFAULT '{}',
  categories        TEXT[] NOT NULL DEFAULT '{}',
  device_codenames  TEXT[] NOT NULL DEFAULT '{}',
  credentials       JSONB NOT NULL DEFAULT '[]',
  portfolio         JSONB NOT NULL DEFAULT '[]',
  contact_channels  JSONB NOT NULL DEFAULT '{}',
  preferred_channel TEXT,
  accepts_escrow    BOOLEAN NOT NULL DEFAULT FALSE,
  is_open_for_work  BOOLEAN NOT NULL DEFAULT TRUE,
  is_anonymous      BOOLEAN NOT NULL DEFAULT FALSE,
  alias             TEXT,
  verified_at       TIMESTAMPTZ,
  rating_avg        NUMERIC(3, 2) NOT NULL DEFAULT 0,
  rating_count      INTEGER NOT NULL DEFAULT 0,
  jobs_completed    INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mp_provider_open
  ON public.marketplace_provider_profiles (is_open_for_work)
  WHERE is_open_for_work = TRUE;

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  owner_uid         TEXT NOT NULL,
  owner_name        TEXT NOT NULL DEFAULT '',
  owner_avatar      TEXT NOT NULL DEFAULT '',
  owner_role        TEXT NOT NULL DEFAULT 'user',
  kind              TEXT NOT NULL CHECK (kind IN ('request', 'offer')),
  title             TEXT NOT NULL,
  body              TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL,
  device_codenames  TEXT[] NOT NULL DEFAULT '{}',
  device_label      TEXT,
  budget_min        NUMERIC(10, 2),
  budget_max        NUMERIC(10, 2),
  currency          TEXT NOT NULL DEFAULT 'USD',
  is_negotiable     BOOLEAN NOT NULL DEFAULT TRUE,
  urgency           TEXT NOT NULL DEFAULT 'normal'
                      CHECK (urgency IN ('low', 'normal', 'high', 'critical')),
  deadline_at       TIMESTAMPTZ,
  delivery_days     INTEGER,
  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'in_progress', 'closed', 'cancelled', 'archived')),
  tags              TEXT[] NOT NULL DEFAULT '{}',
  attachments       JSONB NOT NULL DEFAULT '[]',
  cover_image       TEXT,
  contact_channels  JSONB NOT NULL DEFAULT '{}',
  preferred_channel TEXT,
  is_anonymous      BOOLEAN NOT NULL DEFAULT FALSE,
  views             INTEGER NOT NULL DEFAULT 0,
  contact_clicks    INTEGER NOT NULL DEFAULT 0,
  proposals_count   INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mp_listings_status_kind ON public.marketplace_listings (status, kind, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_listings_owner ON public.marketplace_listings (owner_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_listings_category ON public.marketplace_listings (category) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_mp_listings_tags ON public.marketplace_listings USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_mp_listings_devices ON public.marketplace_listings USING GIN (device_codenames);

CREATE TABLE IF NOT EXISTS public.marketplace_proposals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    TEXT NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  sender_uid    TEXT NOT NULL,
  sender_name   TEXT NOT NULL DEFAULT '',
  sender_avatar TEXT NOT NULL DEFAULT '',
  message       TEXT NOT NULL,
  price         NUMERIC(10, 2),
  currency      TEXT NOT NULL DEFAULT 'USD',
  delivery_days INTEGER,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, sender_uid)
);
CREATE INDEX IF NOT EXISTS idx_mp_proposals_listing ON public.marketplace_proposals (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_proposals_sender ON public.marketplace_proposals (sender_uid, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.mp_touch_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mp_listings_touch ON public.marketplace_listings;
CREATE TRIGGER trg_mp_listings_touch BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.mp_touch_updated_at();
DROP TRIGGER IF EXISTS trg_mp_provider_touch ON public.marketplace_provider_profiles;
CREATE TRIGGER trg_mp_provider_touch BEFORE UPDATE ON public.marketplace_provider_profiles
  FOR EACH ROW EXECUTE FUNCTION public.mp_touch_updated_at();
DROP TRIGGER IF EXISTS trg_mp_proposals_touch ON public.marketplace_proposals;
CREATE TRIGGER trg_mp_proposals_touch BEFORE UPDATE ON public.marketplace_proposals
  FOR EACH ROW EXECUTE FUNCTION public.mp_touch_updated_at();

-- proposals counter
CREATE OR REPLACE FUNCTION public.mp_proposals_count_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.marketplace_listings SET proposals_count = proposals_count + 1 WHERE id = NEW.listing_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.marketplace_listings SET proposals_count = GREATEST(0, proposals_count - 1) WHERE id = OLD.listing_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_mp_proposals_count ON public.marketplace_proposals;
CREATE TRIGGER trg_mp_proposals_count AFTER INSERT OR DELETE ON public.marketplace_proposals
  FOR EACH ROW EXECUTE FUNCTION public.mp_proposals_count_sync();

-- atomic counter helpers
CREATE OR REPLACE FUNCTION public.mp_increment_views(_listing_id TEXT)
RETURNS VOID AS $$ BEGIN UPDATE public.marketplace_listings SET views = views + 1 WHERE id = _listing_id; END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.mp_increment_contact_clicks(_listing_id TEXT)
RETURNS VOID AS $$ BEGIN UPDATE public.marketplace_listings SET contact_clicks = contact_clicks + 1 WHERE id = _listing_id; END; $$ LANGUAGE plpgsql;
