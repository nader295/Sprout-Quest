-- ═══════════════════════════════════════════════════════════════
--  RomX — Migration 007: Helper Functions
--  شغّل بعد 006
-- ═══════════════════════════════════════════════════════════════

-- دالة increment_user_unread (للإشعارات)
CREATE OR REPLACE FUNCTION increment_user_unread(p_uid TEXT)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.users
  SET unread_notifications = unread_notifications + 1,
      updated_at = NOW()
  WHERE id = p_uid;
$$;

-- دالة atomic follow counter increment
CREATE OR REPLACE FUNCTION follow_user(p_follower TEXT, p_following TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.follows (follower_id, following_id, created_at)
  VALUES (p_follower, p_following, NOW())
  ON CONFLICT (follower_id, following_id) DO NOTHING;

  UPDATE public.users SET following_count   = following_count   + 1, updated_at = NOW() WHERE id = p_follower;
  UPDATE public.users SET subscribers_count = subscribers_count + 1, followers_count = followers_count + 1, updated_at = NOW() WHERE id = p_following;
END;
$$;

CREATE OR REPLACE FUNCTION unfollow_user(p_follower TEXT, p_following TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.follows WHERE follower_id = p_follower AND following_id = p_following;
  UPDATE public.users SET following_count   = GREATEST(0, following_count   - 1), updated_at = NOW() WHERE id = p_follower;
  UPDATE public.users SET subscribers_count = GREATEST(0, subscribers_count - 1), followers_count = GREATEST(0, followers_count - 1), updated_at = NOW() WHERE id = p_following;
END;
$$;

-- دالة cleanup الـ presence القديمة (شغّلها من cron كل ساعة)
CREATE OR REPLACE FUNCTION cleanup_old_presence()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.presence WHERE last_seen < NOW() - INTERVAL '15 minutes';
$$;

-- دالة cleanup الـ notif_dedup القديمة (شغّلها من cron يومياً)
CREATE OR REPLACE FUNCTION cleanup_notif_dedup()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.notif_dedup WHERE sent_at < NOW() - INTERVAL '48 hours';
$$;

-- دالة الحصول على الإحصاء (تحل محل settings/stats في Firestore)
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_object_agg(key, value) FROM public.platform_stats;
$$;

-- ═══════════════════════════════════════════════════════════════
--  إضافة الـ cron jobs في Supabase (pg_cron)
--  شغّل في SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- تفعيل pg_cron (مرة واحدة)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- تنظيف presence كل 10 دقايق
-- SELECT cron.schedule('cleanup-presence', '*/10 * * * *', 'SELECT cleanup_old_presence()');

-- تنظيف notif_dedup كل يوم الساعة 3 صبح
-- SELECT cron.schedule('cleanup-notif-dedup', '0 3 * * *', 'SELECT cleanup_notif_dedup()');

-- decay trend scores كل يوم
-- SELECT cron.schedule('decay-trends', '0 0 * * *', 'SELECT decay_trend_scores()');
