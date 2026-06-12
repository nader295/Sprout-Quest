-- scripts/903_comment_like_atomics.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Atomic RPCs for comment like/unlike — fixes read-then-write race condition
-- in /api/comments POST (toggleLike path).
--
-- Previous flow (racy):
--   SELECT likes_count FROM comments WHERE id = X;   -- both A and B read 5
--   UPDATE comments SET likes_count = 6 WHERE id = X; -- both write 6 → lost +1
--
-- New flow (atomic): single UPDATE statement computes the new value in-DB.
-- Returns the final count so the API can echo it back without a second round-trip.
--
-- Safe to re-run (CREATE OR REPLACE + GRANT idempotent). No data modified.
-- ─────────────────────────────────────────────────────────────────────────────

-- NOTE: `comments.id` is UUID (see lib/supabase/schema.sql line 133).
-- Parameter must also be UUID so Postgres doesn't error with
--   "operator does not exist: uuid = text"
-- Supabase JS client serializes the value as a string, Postgres auto-casts
-- the incoming string literal into UUID when the function signature is UUID.

-- Drop any prior (text) signatures from failed runs — safe if absent.
DROP FUNCTION IF EXISTS public.increment_comment_likes(text);
DROP FUNCTION IF EXISTS public.decrement_comment_likes(text);

CREATE OR REPLACE FUNCTION public.increment_comment_likes(p_comment_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.comments
     SET likes_count = COALESCE(likes_count, 0) + 1
   WHERE id = p_comment_id
  RETURNING likes_count;
$$;

CREATE OR REPLACE FUNCTION public.decrement_comment_likes(p_comment_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.comments
     SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1)
   WHERE id = p_comment_id
  RETURNING likes_count;
$$;

-- Only the service_role (used by our sbAdmin server client) should call these.
-- Blocking anon/authenticated prevents clients from bumping counters directly
-- even if RLS policies on `comments` were misconfigured.
REVOKE ALL ON FUNCTION public.increment_comment_likes(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrement_comment_likes(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_comment_likes(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_comment_likes(uuid) TO service_role;
