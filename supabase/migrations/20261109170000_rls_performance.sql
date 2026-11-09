-- Speed up the access rules on profiles, votes and candidates.
--
-- Load testing showed a vote taking ~70 ms as a student (0.2 ms without the
-- access rules), growing with every enrollment. The cause: the profiles rule
-- "Students can view classmates and teachers" ran a self-join of
-- student_enrollments for every profile row, with auth.uid() re-evaluated per
-- row and no index on student_enrollments.course_id. The vote and candidate
-- rules look up profiles, so they paid that cost too, as does every profile
-- lookup by students and lecturers.
--
-- Same access as before, written so the expensive part runs once per query:
-- auth.uid() and the helper functions are wrapped in (SELECT ...) and the
-- classmate/student lists are computed once with IN (...).

BEGIN;

CREATE INDEX IF NOT EXISTS student_enrollments_course_id_idx ON public.student_enrollments (course_id);
CREATE INDEX IF NOT EXISTS courses_teacher_id_idx ON public.courses (teacher_id);

-- Approved student check without going through the profiles access rules
CREATE OR REPLACE FUNCTION public.is_approved_student()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'student' AND status = 'approved'
  );
$$;
REVOKE ALL ON FUNCTION public.is_approved_student() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_student() TO authenticated;

-- profiles
DROP POLICY IF EXISTS "Admins can do everything with profiles" ON public.profiles;
CREATE POLICY "Admins can do everything with profiles"
ON public.profiles FOR ALL TO authenticated
USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Students can view classmates and teachers" ON public.profiles;
CREATE POLICY "Students can view classmates and teachers"
ON public.profiles FOR SELECT
USING (
  status = 'approved'
  AND role IN ('teacher', 'student')
  AND id IN (
    SELECT se2.student_id
    FROM public.student_enrollments se1
    JOIN public.student_enrollments se2 ON se2.course_id = se1.course_id
    WHERE se1.student_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Teachers can view enrolled students" ON public.profiles;
CREATE POLICY "Teachers can view enrolled students"
ON public.profiles FOR SELECT TO authenticated
USING (
  status = 'approved'
  AND (SELECT public.is_teacher())
  AND id IN (
    SELECT se.student_id
    FROM public.courses c
    JOIN public.student_enrollments se ON se.course_id = c.id
    WHERE c.teacher_id = (SELECT auth.uid())
  )
);

-- votes
DROP POLICY IF EXISTS "Students can vote once per position" ON public.votes;
CREATE POLICY "Students can vote once per position"
ON public.votes FOR INSERT TO authenticated
WITH CHECK (voter_id = (SELECT auth.uid()) AND (SELECT public.is_approved_student()));

DROP POLICY IF EXISTS "Voters can see own votes" ON public.votes;
CREATE POLICY "Voters can see own votes"
ON public.votes FOR SELECT TO authenticated
USING (voter_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can view votes" ON public.votes;
CREATE POLICY "Admins can view votes"
ON public.votes FOR SELECT TO authenticated
USING ((SELECT public.is_admin()));

-- candidates
DROP POLICY IF EXISTS "Students can apply" ON public.candidates;
CREATE POLICY "Students can apply"
ON public.candidates FOR INSERT TO authenticated
WITH CHECK (student_id = (SELECT auth.uid()) AND (SELECT public.is_approved_student()));

COMMIT;
