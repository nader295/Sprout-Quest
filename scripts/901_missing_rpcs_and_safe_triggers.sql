-- ═══════════════════════════════════════════════════════════════
-- scripts/901_missing_rpcs_and_safe_triggers.sql
-- ───────────────────────────────────────────────────────────────
-- الهدف: تصحيح 3 RPC calls صامتة في الإنتاج
--   • increment_rom_support        (roms/support/route.ts)
--   • increment_platform_revenue   (roms/ad-support/route.ts)
--   • increment_user_xp            (archive-reports/route.ts)
--
-- + Generic trigger لـ updated_at = now() (آمن، لا يسبب drift).
--
-- مُلاحظة مهمّة: Triggers للعدّادات (likes_count, followers_count,
-- comments_count, rating_avg, roms_count...) ليست ضمن هذا السكربت.
-- سبب التأجيل: الكود الحالي يُحدّث هذه العدّادات يدوياً في:
--   • app/api/follow/route.ts
--   • app/api/roms/actions/post.ts   (likes + ratings)
--   • app/api/comments/route.ts       (comments_count)
--   • app/api/roms/actions/delete.ts  (roms_count)
--   • app/api/roms/actions/post.ts    (roms_count)
-- إضافة triggers الآن = double counting حتمي. ستُضاف في الموجة 2
-- مع إزالة التحديثات اليدوية في نفس التغيير.
--
-- آمن للتنفيذ: IDEMPOTENT (CREATE OR REPLACE + DROP IF EXISTS).
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------
-- 1) RPC: increment_rom_support(p_rom_id text, p_delta int)
--    الاستخدام: app/api/roms/support/route.ts:54
--    الغرض: زيادة roms.support_count تذرّياً
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_rom_support(
  p_rom_id text,
  p_delta  integer DEFAULT 1
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE public.roms
     SET support_count = GREATEST(0, COALESCE(support_count, 0) + p_delta),
         updated_at    = now()
   WHERE id = p_rom_id
   RETURNING support_count INTO new_count;

  RETURN COALESCE(new_count, 0);
END
$$;

REVOKE ALL ON FUNCTION public.increment_rom_support(text, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.increment_rom_support(text, integer) TO service_role;

-- ---------------------------------------------------------------
-- 2) RPC: increment_platform_revenue(p_amount numeric)
--    الاستخدام: app/api/roms/ad-support/route.ts:187
--    الغرض: تحديث إيرادات المنصة في settings/platform_stats
--    التخزين: settings.value->>'total_revenue' (jsonb)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_platform_revenue(
  p_amount numeric
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_val numeric;
  new_val     numeric;
BEGIN
  -- استخراج القيمة الحالية (0 لو مفقودة)
  SELECT COALESCE((value->>'total_revenue')::numeric, 0)
    INTO current_val
    FROM public.settings
   WHERE key = 'platform_revenue';

  new_val := COALESCE(current_val, 0) + COALESCE(p_amount, 0);

  -- upsert
  INSERT INTO public.settings (key, value, updated_at)
  VALUES (
    'platform_revenue',
    jsonb_build_object('total_revenue', new_val, 'last_update', now()),
    now()
  )
  ON CONFLICT (key) DO UPDATE
    SET value      = jsonb_set(
                       COALESCE(settings.value, '{}'::jsonb),
                       '{total_revenue}',
                       to_jsonb(new_val)
                     ) || jsonb_build_object('last_update', now()),
        updated_at = now();

  RETURN new_val;
END
$$;

REVOKE ALL ON FUNCTION public.increment_platform_revenue(numeric) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.increment_platform_revenue(numeric) TO service_role;

-- ---------------------------------------------------------------
-- 3) RPC: increment_user_xp(p_uid text, p_amount int, p_reason text)
--    الاستخدام: app/api/archive-reports/route.ts:122
--    الغرض: إضافة/طرح XP تذرّياً + تسجيل في xp_history
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_user_xp(
  p_uid    text,
  p_amount integer,
  p_reason text DEFAULT 'increment'
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_xp integer;
  new_xp integer;
BEGIN
  -- القيمة الحالية
  SELECT COALESCE(xp, 0) INTO old_xp
    FROM public.users
   WHERE id = p_uid
     FOR UPDATE;                 -- قفل الصف لمنع race

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found: %', p_uid;
  END IF;

  new_xp := GREATEST(0, old_xp + COALESCE(p_amount, 0));

  UPDATE public.users
     SET xp         = new_xp,
         updated_at = now()
   WHERE id = p_uid;

  -- سجل التاريخ
  INSERT INTO public.xp_history (uid, amount, reason, before_xp, after_xp, created_at)
  VALUES (p_uid, p_amount, p_reason, old_xp, new_xp, now());

  RETURN new_xp;
EXCEPTION
  -- لو جدول xp_history بعمود مختلف أو غير موجود، نكمل بدون فشل
  WHEN undefined_column OR undefined_table THEN
    RETURN new_xp;
END
$$;

REVOKE ALL ON FUNCTION public.increment_user_xp(text, integer, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.increment_user_xp(text, integer, text) TO service_role;

-- ---------------------------------------------------------------
-- 4) Generic updated_at trigger function (آمن)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

-- تركيب الـ trigger على الجداول التي لها عمود updated_at
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM   pg_class c
    JOIN   pg_namespace n ON n.oid = c.relnamespace
    JOIN   pg_attribute a ON a.attrelid = c.oid
    WHERE  n.nspname  = 'public'
      AND  c.relkind  = 'r'
      AND  a.attname  = 'updated_at'
      AND  a.attnum   > 0
      AND  NOT a.attisdropped
  LOOP
    -- drop + create حتى يكون IDEMPOTENT
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I',
      r.table_name
    );
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      r.table_name
    );
    RAISE NOTICE 'trigger set_updated_at on public.%', r.table_name;
  END LOOP;
END $$;

COMMIT;

DO $$ BEGIN
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE '  scripts/901 applied:';
  RAISE NOTICE '    + increment_rom_support       (RPC)';
  RAISE NOTICE '    + increment_platform_revenue  (RPC)';
  RAISE NOTICE '    + increment_user_xp           (RPC)';
  RAISE NOTICE '    + set_updated_at              (generic trigger)';
  RAISE NOTICE '  Counter-triggers deferred to Wave 2 to avoid';
  RAISE NOTICE '  double-counting with existing manual counter code.';
  RAISE NOTICE '══════════════════════════════════════════════════════';
END $$;
