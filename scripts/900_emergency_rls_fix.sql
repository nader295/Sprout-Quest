-- ═══════════════════════════════════════════════════════════════
-- scripts/900_emergency_rls_fix.sql
-- ───────────────────────────────────────────────────────────────
-- الهدف: إغلاق الوصول المباشر من anon key (المتصفّح) إلى جميع
-- الجداول. بعد التنفيذ:
--   • anon  (المتصفح) = لا يقرأ ولا يكتب أي صف (RLS فعّال بلا policy)
--   • service_role (sbAdmin في الخادم) = يتجاوز RLS بشكل افتراضي
--   • authenticated (غير مستخدم — المشروع يعتمد Firebase Auth) = محظور
--
-- السبب: REVIEW_LOG.md الجزء 12 — 32 جدول مكشوف + 11 جدول
-- بسياسة USING (true) تُسرّب PII ومالية.
--
-- آمن للتنفيذ على الإنتاج:
--   - IDEMPOTENT: يمكن إعادة التشغيل بلا ضرر
--   - لا يحذف بيانات
--   - كل sbAdmin calls في الكود تستمر بالعمل (service_role يتجاوز RLS)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------
-- 1) قائمة الجداول الحساسة — تفعيل RLS + حذف policies الخطيرة
-- ---------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  p RECORD;
  tables TEXT[] := ARRAY[
    -- مالية حرجة (حصص/تسويات/احتيال/أرباح)
    'payout_requests', 'monthly_settlements', 'financial_audit_log',
    'fraud_alerts',    'linkvertise_clicks',

    -- إدارة (سجلات/إعدادات/طلبات)
    'admin_logs',      'settings',           'announcements',
    'archive_reports', 'applications',       'appeals',
    'owner_claims',    'bug_reports',        'feedback',
    'reserved_usernames', 'migration_history',

    -- بيانات حساسة (هوية/إشعارات)
    'push_tokens',     'xp_history',         'xp_log',
    'notif_dedup',     'xp_comments_dedup',
    'search_analytics','collaborators',      'device_watches',

    -- بنية تحتية (بيانات تشغيل)
    'devices',              'downloads_dedup', 'views_dedup',
    'rom_daily_stats',      'device_codename_votes', 'platform_stats',

    -- الـ 11 جدول ذات public_read الخاطئ
    'users',        'notifications', 'presence',
    'follows',      'likes',         'ratings',
    'comments',     'roms',          'activity',
    'feed_items',   'reports',       'roms_versions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      -- حذف كل policies الحالية (خصوصاً _public_read USING(true))
      FOR p IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      END LOOP;

      -- تفعيل RLS (+ FORCE حتى لو كان المالك هو الذي يستعلم)
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);

      RAISE NOTICE 'RLS locked: public.%', t;
    ELSE
      RAISE NOTICE 'skipped (missing): public.%', t;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------
-- 2) تحقق بصري — عرض الحالة النهائية
-- ---------------------------------------------------------------
-- لا يمكن استخدام SELECT في DO block، لكن يمكن تركها كـ comment
-- للمراجعة اليدوية:
--
--   SELECT tablename, rowsecurity
--   FROM   pg_tables
--   WHERE  schemaname = 'public'
--   ORDER  BY tablename;
--
--   SELECT tablename, count(*) AS policies
--   FROM   pg_policies
--   WHERE  schemaname = 'public'
--   GROUP  BY tablename
--   ORDER  BY tablename;
--
-- النتيجة المتوقّعة: rowsecurity = true لكل الجداول أعلاه،
-- وعدد الـ policies لها = 0.
-- ---------------------------------------------------------------

COMMIT;

-- إشعار نهائي
DO $$ BEGIN
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE '  scripts/900 applied — anon key is now locked out.';
  RAISE NOTICE '  sbAdmin (service_role) still works in all API routes.';
  RAISE NOTICE '══════════════════════════════════════════════════════';
END $$;
