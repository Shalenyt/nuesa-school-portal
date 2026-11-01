-- 1. Rules that check admin/lecturer status only apply to signed-in users,
--    so logged-out visitors never need to run those checks.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND roles::text = '{public}'
      AND (coalesce(qual,'') || coalesce(with_check,'')) ~ '(is_admin|is_teacher|get_user_role)\('
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 2. Role checks: signed-in users only.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_teacher() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, service_role;

-- 3. Automatic helpers: nobody calls them directly; they still run automatically.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_single_active_semester() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 4. Semester switch: admins only.
CREATE OR REPLACE FUNCTION public.auto_manage_semester_lifecycle()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can manage the semester';
  END IF;

  UPDATE semester_config SET is_active = false, updated_at = now()
  WHERE end_date < CURRENT_DATE AND is_active = true;

  IF NOT EXISTS (SELECT 1 FROM semester_config WHERE is_active = true) THEN
    UPDATE semester_config SET is_active = true, updated_at = now()
    WHERE id = (
      SELECT id FROM semester_config
      WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
      ORDER BY start_date DESC
      LIMIT 1
    );
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.auto_manage_semester_lifecycle() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_manage_semester_lifecycle() TO authenticated, service_role;