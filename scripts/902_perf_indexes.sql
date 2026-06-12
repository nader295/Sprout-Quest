-- ────────────────────────────────────────────────────────────────────
-- 902_perf_indexes.sql
-- ────────────────────────────────────────────────────────────────────
-- Adds composite and partial indexes on high-traffic tables that are
-- queried on every ROM page load (likes, ratings, comments) but had
-- NO indexes at all — meaning every checkLiked / getRating call was a
-- sequential scan.
--
-- All statements use IF NOT EXISTS + CONCURRENTLY-compatible patterns
-- and are idempotent. Safe to re-run.
-- ────────────────────────────────────────────────────────────────────

-- ── likes ───────────────────────────────────────────────────────────
-- Hot path: "did user X like ROM Y" (checkLiked) — composite PK-like.
CREATE INDEX IF NOT EXISTS idx_likes_user_rom
  ON public.likes (user_id, rom_id);

-- Hot path: "show me everyone who liked ROM Y" (feed display).
CREATE INDEX IF NOT EXISTS idx_likes_rom_id
  ON public.likes (rom_id);

-- Hot path: "my likes, newest first" (bounded 2000).
CREATE INDEX IF NOT EXISTS idx_likes_user_created
  ON public.likes (user_id, created_at DESC);

-- ── ratings ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ratings_user_rom
  ON public.ratings (user_id, rom_id);

CREATE INDEX IF NOT EXISTS idx_ratings_rom_id
  ON public.ratings (rom_id);

-- ── comments ────────────────────────────────────────────────────────
-- Comments are listed per-ROM, newest first, in every ROM detail page.
CREATE INDEX IF NOT EXISTS idx_comments_rom_created
  ON public.comments (rom_id, created_at DESC);

-- For user profile "my comments" tab if used.
CREATE INDEX IF NOT EXISTS idx_comments_user_id
  ON public.comments (user_id);

-- Parent threading: reply lookups walk comment_id → replies.
CREATE INDEX IF NOT EXISTS idx_comments_parent
  ON public.comments (parent_id)
  WHERE parent_id IS NOT NULL;

-- ── roms: featured + recent (homepage) ──────────────────────────────
-- Common query: WHERE featured = true ORDER BY created_at DESC.
-- Partial index = tiny and dramatically faster than full scan + sort.
CREATE INDEX IF NOT EXISTS idx_roms_featured_recent
  ON public.roms (created_at DESC)
  WHERE featured = TRUE;

-- Common query: WHERE content_type = ? ORDER BY trend_score DESC.
CREATE INDEX IF NOT EXISTS idx_roms_type_trend
  ON public.roms (content_type, trend_score DESC);

-- ── notifications: unread counter queries ───────────────────────────
-- Partial index for the hot "how many unread?" path.
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (recipient_uid, created_at DESC)
  WHERE read = FALSE;

-- ── feed_items: dedupe on fanout + trim ─────────────────────────────
-- backfillFeedOnFollow uses upsert with ignoreDuplicates → needs a
-- unique-ish composite. The existing idx_feed_items_owner_created covers
-- ordered reads, but (owner_uid, actor_uid) speeds unfollow cleanup.
CREATE INDEX IF NOT EXISTS idx_feed_items_owner_actor
  ON public.feed_items (owner_uid, actor_uid);

-- ── users: leaderboard by XP among non-suspended accounts ───────────
CREATE INDEX IF NOT EXISTS idx_users_xp_active
  ON public.users (xp DESC)
  WHERE is_suspended = FALSE;

-- ── follows: symmetric lookups already indexed in 006; add count. ───
-- No-op if already present.

ANALYZE public.likes;
ANALYZE public.ratings;
ANALYZE public.comments;
ANALYZE public.roms;
ANALYZE public.notifications;
ANALYZE public.feed_items;
ANALYZE public.users;
