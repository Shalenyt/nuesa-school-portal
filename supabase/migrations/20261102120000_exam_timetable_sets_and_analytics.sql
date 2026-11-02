-- Exam timetables per semester, and accurate admin analytics.
--
-- 1. An exam timetable now belongs to one semester. The admin starts it for
--    the current semester, adds days and entries while it is a draft, then
--    publishes it. Students and lecturers only see a published timetable for
--    the current semester, and only until that semester's vacation date.
--    After that it counts as archived: hidden from them, kept for admins.
-- 2. admin_analytics_summary() returns the analytics page numbers straight
--    from the database.

BEGIN;

-- 1. Timetable per semester
CREATE TABLE IF NOT EXISTS public.exam_timetable_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL UNIQUE REFERENCES public.semester_config(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_timetable_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage exam timetable sets" ON public.exam_timetable_sets;
CREATE POLICY "Admins manage exam timetable sets"
ON public.exam_timetable_sets FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Signed in users can view exam timetable sets" ON public.exam_timetable_sets;
CREATE POLICY "Signed in users can view exam timetable sets"
ON public.exam_timetable_sets FOR SELECT TO authenticated
USING (true);

DROP TRIGGER IF EXISTS update_exam_timetable_sets_updated_at ON public.exam_timetable_sets;
CREATE TRIGGER update_exam_timetable_sets_updated_at
BEFORE UPDATE ON public.exam_timetable_sets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.exam_timetables
  ADD COLUMN IF NOT EXISTS set_id uuid REFERENCES public.exam_timetable_sets(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS exam_timetables_set_id_idx ON public.exam_timetables(set_id);

-- Students and lecturers only see the live timetable. Admins see everything.
DROP POLICY IF EXISTS "Authenticated users can view exam timetables" ON public.exam_timetables;
DROP POLICY IF EXISTS "Users can view the live exam timetable" ON public.exam_timetables;
CREATE POLICY "Users can view the live exam timetable"
ON public.exam_timetables FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.exam_timetable_sets s
    JOIN public.semester_config c ON c.id = s.semester_id
    WHERE s.id = exam_timetables.set_id
      AND s.status = 'published'
      AND c.is_active = true
      AND (now() AT TIME ZONE 'Africa/Lagos')::date <= c.end_date
  )
);

-- 2. Analytics numbers
CREATE OR REPLACE FUNCTION public.admin_analytics_summary()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Month boundaries in Nigerian time
  this_month timestamptz := date_trunc('month', now() AT TIME ZONE 'Africa/Lagos') AT TIME ZONE 'Africa/Lagos';
  last_month timestamptz := (date_trunc('month', now() AT TIME ZONE 'Africa/Lagos') - interval '1 month') AT TIME ZONE 'Africa/Lagos';
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can view analytics';
  END IF;

  RETURN json_build_object(
    'enrolled_students', (
      SELECT count(DISTINCT e.student_id)
      FROM student_enrollments e JOIN profiles p ON p.id = e.student_id
      WHERE p.role = 'student' AND p.status = 'approved'),
    'course_registrations', (
      SELECT count(*)
      FROM student_enrollments e JOIN profiles p ON p.id = e.student_id
      WHERE p.role = 'student' AND p.status = 'approved'),
    'total_students', (
      SELECT count(*) FROM profiles WHERE role = 'student' AND status = 'approved'),
    'students_at_month_start', (
      SELECT count(*) FROM profiles WHERE role = 'student' AND status = 'approved' AND created_at < this_month),
    'new_students_this_month', (
      SELECT count(*) FROM profiles WHERE role = 'student' AND status = 'approved' AND created_at >= this_month),
    'new_students_last_month', (
      SELECT count(*) FROM profiles WHERE role = 'student' AND status = 'approved'
        AND created_at >= last_month AND created_at < this_month),
    'total_courses', (SELECT count(*) FROM courses),
    'courses_with_students', (SELECT count(DISTINCT course_id) FROM student_enrollments),
    'submissions', (SELECT count(*) FROM assignment_submissions),
    'graded_submissions', (SELECT count(*) FROM assignment_submissions WHERE grade IS NOT NULL)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_analytics_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_analytics_summary() TO authenticated;

COMMIT;
