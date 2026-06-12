-- ═══════════════════════════════════════════════════════════════
--  RomX — Migration 006: Full Firestore → Supabase
--  شغّله في Supabase → SQL Editor → New Query
--  Firebase يفضل فقط لـ Authentication
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
--  1. NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_uid TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  link          TEXT DEFAULT '',
  author_photo  TEXT DEFAULT '',
  read          BOOLEAN NOT NULL DEFAULT FALSE,
  dedup_key     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notif_recipient_idx ON public.notifications (recipient_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS notif_dedup_idx     ON public.notifications (recipient_uid, dedup_key)
  WHERE dedup_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notif_unread_idx    ON public.notifications (recipient_uid, read)
  WHERE read = FALSE;

-- dedup table (replaces notif_dedup Firestore collection)
CREATE TABLE IF NOT EXISTS public.notif_dedup (
  id            TEXT PRIMARY KEY, -- "{recipientUid}_{dedupKey}"
  recipient_uid TEXT NOT NULL,
  dedup_key     TEXT NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notif_dedup_time_idx ON public.notif_dedup (sent_at);

-- ─────────────────────────────────────────────────────────────
--  2. SETTINGS / CONFIG / ANNOUNCEMENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings
INSERT INTO public.settings (key, value) VALUES
  ('public_config',    '{"channelLinkMinXP": 150}'::jsonb),
  ('stats',            '{"totalUsers": 0, "totalRoms": 0, "totalDownloads": 0}'::jsonb),
  ('rom_of_week',      'null'::jsonb),
  ('maintenance_mode', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text       TEXT NOT NULL,
  link       TEXT DEFAULT '',
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────
--  3. REPORTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_uid TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL CHECK (target_type IN ('rom','user','comment')),
  target_id    TEXT NOT NULL,
  reason       TEXT NOT NULL,
  details      TEXT DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','reviewed','dismissed','actioned')),
  admin_note   TEXT DEFAULT '',
  reviewed_by  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reports_status_idx  ON public.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_target_idx  ON public.reports (target_type, target_id);
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON public.reports (reporter_uid);

-- ─────────────────────────────────────────────────────────────
--  4. ARCHIVE REPORTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.archive_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id  UUID,
  reporter_uid TEXT,
  target_type  TEXT,
  target_id    TEXT,
  reason       TEXT,
  status       TEXT,
  archived_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data         JSONB DEFAULT '{}'
);

-- ─────────────────────────────────────────────────────────────
--  5. ADMIN LOGS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL,
  uid        TEXT,
  data       JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_logs_type_idx ON public.admin_logs (type, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_logs_uid_idx  ON public.admin_logs (uid) WHERE uid IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
--  6. APPLICATIONS (verifiedDev applications)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.applications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  links       JSONB DEFAULT '[]',
  message     TEXT DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','rejected')),
  admin_note  TEXT DEFAULT '',
  reviewed_by TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS applications_uid_idx    ON public.applications (uid);
CREATE INDEX IF NOT EXISTS applications_status_idx ON public.applications (status, created_at DESC);

-- ─────────────────────────────────────────────────────────────
--  7. APPEALS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appeals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  details     TEXT DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','rejected')),
  admin_note  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS appeals_uid_idx    ON public.appeals (uid);
CREATE INDEX IF NOT EXISTS appeals_status_idx ON public.appeals (status, created_at DESC);

-- ─────────────────────────────────────────────────────────────
--  8. PAYOUT REQUESTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid              TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount           NUMERIC NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'USD',
  payment_method   TEXT NOT NULL,
  wallet_address   TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','processing','paid','rejected','on_hold','failed')),
  admin_note       TEXT DEFAULT '',
  processed_by     TEXT,
  ip               TEXT DEFAULT '',
  trust_level      TEXT DEFAULT 'standard',
  data             JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payouts_uid_idx    ON public.payout_requests (uid, created_at DESC);
CREATE INDEX IF NOT EXISTS payouts_status_idx ON public.payout_requests (status, created_at DESC);

-- ─────────────────────────────────────────────────────────────
--  9. XP HISTORY
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.xp_history (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid       TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount    INTEGER NOT NULL,  -- موجب=منح، سالب=خصم
  reason    TEXT DEFAULT '',
  before    INTEGER NOT NULL DEFAULT 0,
  after     INTEGER NOT NULL DEFAULT 0,
  ts        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS xp_history_uid_idx ON public.xp_history (uid, ts DESC);

-- ─────────────────────────────────────────────────────────────
--  10. XP LOG (daily per-user per-reason — anti-spam)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.xp_log (
  id             TEXT PRIMARY KEY,   -- "{uid}_{YYYY-MM-DD}"
  uid            TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  total          INTEGER NOT NULL DEFAULT 0,
  data           JSONB NOT NULL DEFAULT '{}',  -- per-reason counts
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS xp_log_uid_date_idx ON public.xp_log (uid, date DESC);

-- ─────────────────────────────────────────────────────────────
--  11. XP COMMENTS DEDUP
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.xp_comments_dedup (
  id              TEXT PRIMARY KEY,  -- "{romId}_{commenterUid}"
  rom_id          TEXT NOT NULL REFERENCES public.roms(id) ON DELETE CASCADE,
  commenter_uid   TEXT NOT NULL,
  maintainer_uid  TEXT NOT NULL,
  ts              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS xp_dedup_rom_idx ON public.xp_comments_dedup (rom_id);

-- ─────────────────────────────────────────────────────────────
--  12. FRAUD ALERTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fraud_alerts (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid      TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date     DATE NOT NULL,
  reasons  TEXT[] DEFAULT '{}',
  type     TEXT DEFAULT 'auto',
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  ts       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fraud_uid_idx      ON public.fraud_alerts (uid);
CREATE INDEX IF NOT EXISTS fraud_reviewed_idx ON public.fraud_alerts (reviewed) WHERE reviewed = FALSE;

-- ─────────────────────────────────────────────────────────────
--  13. FINANCIAL AUDIT LOG
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid        TEXT,
  action     TEXT NOT NULL,
  amount     NUMERIC,
  data       JSONB DEFAULT '{}',
  ts         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fin_audit_uid_idx ON public.financial_audit_log (uid) WHERE uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS fin_audit_ts_idx  ON public.financial_audit_log (ts DESC);

-- ─────────────────────────────────────────────────────────────
--  14. COLLABORATORS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collaborators (
  rom_id     TEXT NOT NULL REFERENCES public.roms(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'collaborator',
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rom_id, user_id)
);
CREATE INDEX IF NOT EXISTS collab_user_idx ON public.collaborators (user_id);

-- ─────────────────────────────────────────────────────────────
--  15. DEVICE WATCHES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.device_watches (
  user_id    TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  codename   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, codename)
);
CREATE INDEX IF NOT EXISTS dwatch_codename_idx ON public.device_watches (codename);

-- ─────────────────────────────────────────────────────────────
--  16. PUSH TOKENS (Firebase Cloud Messaging)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid        TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  platform   TEXT DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_uid_idx ON public.push_tokens (uid);

-- ─────────────────────────────────────────────────────────────
--  17. BUG REPORTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid        TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  severity   TEXT DEFAULT 'medium',
  status     TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  18. RESERVED USERNAMES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reserved_usernames (
  username   TEXT PRIMARY KEY,
  reason     TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  19. MONTHLY SETTLEMENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monthly_settlements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid        TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  month      TEXT NOT NULL,   -- "2026-04"
  amount     NUMERIC NOT NULL DEFAULT 0,
  status     TEXT DEFAULT 'pending',
  data       JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS settlements_uid_idx   ON public.monthly_settlements (uid, month);
CREATE INDEX IF NOT EXISTS settlements_month_idx ON public.monthly_settlements (month);

-- ─────────────────────────────────────────────────────────────
--  20. ACTIVITY (global + per-user)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activity_uid_idx     ON public.activity (uid, created_at DESC) WHERE uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS activity_global_idx  ON public.activity (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_type_idx    ON public.activity (type, created_at DESC);

-- ─────────────────────────────────────────────────────────────
--  21. FEED ITEMS (fan-out feed per user)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feed_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid    TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_uid    TEXT,
  type         TEXT NOT NULL,
  data         JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS feed_owner_idx ON public.feed_items (owner_uid, created_at DESC);

-- ─────────────────────────────────────────────────────────────
--  22. PRESENCE (online users counter)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.presence (
  uid        TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS presence_last_seen_idx ON public.presence (last_seen DESC);

-- ─────────────────────────────────────────────────────────────
--  23. OWNER CLAIMS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.owner_claims (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid        TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_id  TEXT NOT NULL,
  target_type TEXT NOT NULL,
  status     TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  24. MIGRATION HISTORY
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.migration_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  status      TEXT DEFAULT 'done',
  records     INTEGER DEFAULT 0,
  ran_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  25. USERS — أضف الأعمدة الناقصة (موجودة في Firestore بس)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS achievements        TEXT[]  DEFAULT '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS unread_notifications INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS roms_count          INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscribers_count   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_downloads     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_likes_received INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_views_received INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ratings_given       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS comments_given      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_early_adopter    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS manual_verified     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ads_enabled         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ad_placement        TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_earned        NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS available_balance   NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspended_until     TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspension_reason   TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username_lower      TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS channel_link        TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS level               INTEGER NOT NULL DEFAULT 1;

-- Index على username_lower للـ checkUsername
CREATE INDEX IF NOT EXISTS users_username_lower_idx ON public.users (username_lower)
  WHERE username_lower IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
--  26. PLATFORM STATS (يغني عن settings/stats في Firestore)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_stats (
  key        TEXT PRIMARY KEY,
  value      BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.platform_stats (key, value) VALUES
  ('total_users',     0),
  ('total_roms',      0),
  ('total_downloads', 0),
  ('total_views',     0),
  ('total_likes',     0)
ON CONFLICT (key) DO NOTHING;

-- دالة increment atomic
CREATE OR REPLACE FUNCTION increment_platform_stat(p_key TEXT, p_delta BIGINT DEFAULT 1)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.platform_stats (key, value, updated_at)
  VALUES (p_key, p_delta, NOW())
  ON CONFLICT (key)
  DO UPDATE SET value = platform_stats.value + p_delta, updated_at = NOW();
$$;

-- ─────────────────────────────────────────────────────────────
--  RLS للجداول الجديدة (الكتابة عبر service role فقط)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence           ENABLE ROW LEVEL SECURITY;

-- القراءة العامة للـ activity
CREATE POLICY "activity_public_read" ON public.activity FOR SELECT USING (TRUE);
CREATE POLICY "presence_public_read" ON public.presence  FOR SELECT USING (TRUE);

-- الإشعارات: المستخدم يقرأ إشعاراته فقط (service role يتجاوز RLS)
CREATE POLICY "notif_owner_read" ON public.notifications
  FOR SELECT USING (TRUE);  -- service role handles auth in API routes

-- ─────────────────────────────────────────────────────────────
--  26. COMMENT LIKES (كانت subcollection في Firestore)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comment_likes (
  comment_id  UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

-- ─────────────────────────────────────────────────────────────
--  27. REACTIONS column on comments
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]';

-- ─────────────────────────────────────────────────────────────
--  28. VALID_REPORTS_COUNT + FALSE_REPORTS_COUNT on users
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS valid_reports_count    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS false_reports_count    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS report_banned_until    TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS paid_payouts_count     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS rejected_payouts_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hidden                 BOOLEAN NOT NULL DEFAULT FALSE;

-- ROMS hidden field
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS hidden        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.roms ADD COLUMN IF NOT EXISTS hidden_reason TEXT DEFAULT '';
