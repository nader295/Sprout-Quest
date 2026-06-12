-- scripts/904_rom_counter_atomics.sql
-- ──────────────────────────────────────────────────────────────────
-- Atomic RPCs for ROM counters to eliminate read-then-write races.
--
-- BEFORE (lossy):   SELECT likes_count → new = old+1 → UPDATE likes_count = new
--   Two concurrent likes both read 5, both write 6. One like vanishes.
--
-- AFTER (atomic):   UPDATE ... SET likes_count = likes_count + 1 (single statement)
--
-- Idempotent: CREATE OR REPLACE. Safe to run multiple times.
-- GRANT limited to service_role; no anon/authenticated direct RPC access.
-- ──────────────────────────────────────────────────────────────────

-- ── Likes counter ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_rom_likes(p_rom_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.roms
     SET likes_count = COALESCE(likes_count, 0) + 1,
         updated_at  = NOW()
   WHERE id = p_rom_id;
$$;

CREATE OR REPLACE FUNCTION public.decrement_rom_likes(p_rom_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.roms
     SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1),
         updated_at  = NOW()
   WHERE id = p_rom_id;
$$;

-- ── Downloads counter (with trend_score bump) ──────────────────────
-- Returns the new value so the caller can detect milestones (100/500/1000)
-- without re-reading. The +3 trend delta matches the previous constant.
CREATE OR REPLACE FUNCTION public.increment_rom_downloads(p_rom_id text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_dl integer;
BEGIN
  UPDATE public.roms
     SET downloads   = COALESCE(downloads, 0) + 1,
         trend_score = COALESCE(trend_score, 0) + 3,
         updated_at  = NOW()
   WHERE id = p_rom_id
   RETURNING downloads INTO new_dl;

  RETURN COALESCE(new_dl, 0);
END;
$$;

-- ── Views counter ──────────────────────────────────────────────────
-- Returns new total_views so the caller can compute milestone boundaries
-- (prev = new_views - 1) without a second round-trip.
CREATE OR REPLACE FUNCTION public.increment_rom_views(p_rom_id text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_views integer;
BEGIN
  UPDATE public.roms
     SET total_views = COALESCE(total_views, 0) + 1,
         updated_at  = NOW()
   WHERE id = p_rom_id
   RETURNING total_views INTO new_views;

  RETURN COALESCE(new_views, 0);
END;
$$;

-- ── Atomic upsert rating (the big one) ─────────────────────────────
-- Previously: read rating_count/rating_sum → compute → write. Two concurrent
-- ratings on the same ROM could corrupt rating_avg permanently.
--
-- This function does the whole upsert + recompute under a row lock on the ROM,
-- then returns the new aggregates.
CREATE OR REPLACE FUNCTION public.upsert_rom_rating(
  p_rom_id  text,
  p_user_id text,
  p_score   smallint
) RETURNS TABLE(rating_count integer, rating_sum integer, rating_avg numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_score smallint;
  v_count     integer;
  v_sum       integer;
  v_avg       numeric(3,1);
BEGIN
  IF p_score < 1 OR p_score > 5 THEN
    RAISE EXCEPTION 'score must be 1..5';
  END IF;

  -- Lock the ROM row for the duration of the transaction so concurrent
  -- rate calls on the same ROM serialize around this block.
  PERFORM 1 FROM public.roms WHERE id = p_rom_id FOR UPDATE;

  -- Fetch existing score (if any) for this user/rom.
  SELECT score INTO v_old_score
    FROM public.ratings
   WHERE rom_id = p_rom_id AND user_id = p_user_id;

  -- Upsert the user's rating.
  INSERT INTO public.ratings (rom_id, user_id, score, updated_at)
  VALUES (p_rom_id, p_user_id, p_score, NOW())
  ON CONFLICT (rom_id, user_id)
  DO UPDATE SET score = EXCLUDED.score, updated_at = EXCLUDED.updated_at;

  -- Delta-based aggregate update.
  IF v_old_score IS NULL THEN
    UPDATE public.roms
       SET rating_count = COALESCE(rating_count, 0) + 1,
           rating_sum   = COALESCE(rating_sum, 0) + p_score,
           updated_at   = NOW()
     WHERE id = p_rom_id;
  ELSE
    UPDATE public.roms
       SET rating_sum = COALESCE(rating_sum, 0) - v_old_score + p_score,
           updated_at = NOW()
     WHERE id = p_rom_id;
  END IF;

  -- Recompute avg and return.
  UPDATE public.roms
     SET rating_avg = CASE
       WHEN COALESCE(rating_count, 0) > 0
         THEN ROUND((COALESCE(rating_sum, 0)::numeric / rating_count) * 10) / 10
       ELSE 0
     END
   WHERE id = p_rom_id
  RETURNING rating_count, rating_sum, rating_avg INTO v_count, v_sum, v_avg;

  rating_count := v_count;
  rating_sum   := v_sum;
  rating_avg   := v_avg;
  RETURN NEXT;
END;
$$;

-- ── GRANTs — service_role only ─────────────────────────────────────
REVOKE ALL ON FUNCTION public.increment_rom_likes(text)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrement_rom_likes(text)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_rom_downloads(text)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_rom_views(text)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_rom_rating(text, text, smallint) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.increment_rom_likes(text)      TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_rom_likes(text)      TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_rom_downloads(text)  TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_rom_views(text)      TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_rom_rating(text, text, smallint) TO service_role;
