-- Security review fixes (November 2026)
--
-- 1. Sign-up can only create student or lecturer accounts. Admins are made
--    from Manage Users ("Promote to Admin").
-- 2. Students could write a "paid" payment record for themselves without
--    paying. Payments are recorded only by the paystack-verify function.
-- 3. Students could enroll themselves in any course (and so read its
--    materials, quizzes and assignments). Enrollment is now automatic.
-- 4. Any lecturer could edit or delete any course. Only admins can now.
-- 5. Unapproved accounts with the teacher or admin role could send
--    notifications to anyone.
-- 6. Students could set their own quiz score, and their own assignment
--    grade or feedback when submitting.
-- 7. Students could read the correct answers of a quiz through the API.
--    Questions now come from a function that leaves the answers out.
-- 8. Students could check in to any attendance session, including closed
--    ones, from anywhere. Check-in now requires an open session for one of
--    their courses, and the distance is worked out by the database.
-- 9. Newly approved students were never enrolled in their courses, and
--    courses added later never reached existing students. Both now happen
--    automatically.

BEGIN;

-- 1. Sign-up: student or lecturer only
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_first text := NULLIF(btrim(COALESCE(new.raw_user_meta_data->>'first_name', '')), '');
  v_last text := NULLIF(btrim(COALESCE(new.raw_user_meta_data->>'last_name', '')), '');
  v_middle text := NULLIF(btrim(COALESCE(new.raw_user_meta_data->>'middle_name', '')), '');
  v_full text := NULLIF(btrim(COALESCE(new.raw_user_meta_data->>'full_name', '')), '');
  -- Anything other than lecturer (including "admin") signs up as a student
  v_role public.user_role := CASE
    WHEN new.raw_user_meta_data->>'role' = 'teacher' THEN 'teacher'::public.user_role
    ELSE 'student'::public.user_role
  END;
BEGIN
  IF v_full IS NULL THEN
    v_full := btrim(concat_ws(' ', v_last, v_first, v_middle));
  END IF;

  IF v_first IS NULL AND v_full IS NOT NULL THEN
    v_first := NULLIF(split_part(v_full, ' ', 1), '');
  END IF;

  INSERT INTO public.profiles (id, full_name, first_name, last_name, middle_name, email, role, student_id, staff_id, department_id, level_id)
  VALUES (
    new.id,
    COALESCE(v_full, ''),
    v_first,
    v_last,
    v_middle,
    new.email,
    v_role,
    CASE WHEN v_role = 'student' THEN new.raw_user_meta_data->>'student_id' END,
    CASE WHEN v_role = 'teacher' THEN new.raw_user_meta_data->>'staff_id' END,
    CASE
      WHEN v_role = 'student' AND COALESCE(new.raw_user_meta_data->>'subjectId', '') <> ''
      THEN (new.raw_user_meta_data->>'subjectId')::uuid
    END,
    CASE
      WHEN v_role = 'student' AND COALESCE(new.raw_user_meta_data->>'classId', '') <> ''
      THEN (new.raw_user_meta_data->>'classId')::uuid
    END
  );
  RETURN new;
END;
$function$;

-- 2. Payment records only from the payment function (or admins)
DROP POLICY IF EXISTS "Students can insert own payments" ON public.payment_records;

-- 3. No self-enrollment
DROP POLICY IF EXISTS "Students can enroll themselves" ON public.student_enrollments;

-- 4. Courses: admins only for changes (everyone can still read them)
DROP POLICY IF EXISTS "Admins and teachers can manage courses" ON public.courses;
DROP POLICY IF EXISTS "Admins can manage courses" ON public.courses;
CREATE POLICY "Admins can manage courses"
ON public.courses FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. Notifications only from approved admins and lecturers
DROP POLICY IF EXISTS "Only admins can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Teachers can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Approved staff can create notifications" ON public.notifications;
CREATE POLICY "Approved staff can create notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.is_teacher());

-- 6a. Quiz submissions: only the quiz's lecturer or an admin sets the score
CREATE OR REPLACE FUNCTION public.protect_quiz_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin()
     OR EXISTS (SELECT 1 FROM quizzes q WHERE q.id = NEW.quiz_id AND q.created_by = auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.score := NULL;
    NEW.graded_at := NULL;
    NEW.graded_by := NULL;
    RETURN NEW;
  END IF;

  -- A student may only clear their own location data after submitting
  IF NEW.score IS DISTINCT FROM OLD.score
     OR NEW.graded_at IS DISTINCT FROM OLD.graded_at
     OR NEW.graded_by IS DISTINCT FROM OLD.graded_by
     OR NEW.answers IS DISTINCT FROM OLD.answers
     OR NEW.quiz_id IS DISTINCT FROM OLD.quiz_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
     OR NEW.tab_switch_count IS DISTINCT FROM OLD.tab_switch_count THEN
    RAISE EXCEPTION 'A submitted quiz cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.protect_quiz_submission() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS quiz_submissions_protect ON public.quiz_submissions;
CREATE TRIGGER quiz_submissions_protect
BEFORE INSERT OR UPDATE ON public.quiz_submissions
FOR EACH ROW EXECUTE FUNCTION public.protect_quiz_submission();

-- 6b. Assignment submissions: only the course lecturer or an admin grades
CREATE OR REPLACE FUNCTION public.protect_assignment_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin()
     OR EXISTS (
       SELECT 1 FROM assignments a JOIN courses c ON c.id = a.course_id
       WHERE a.id = NEW.assignment_id AND c.teacher_id = auth.uid()
     ) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.grade := NULL;
    NEW.graded_at := NULL;
    NEW.graded_by := NULL;
    NEW.feedback := NULL;
    RETURN NEW;
  END IF;

  IF NEW.grade IS DISTINCT FROM OLD.grade
     OR NEW.graded_at IS DISTINCT FROM OLD.graded_at
     OR NEW.graded_by IS DISTINCT FROM OLD.graded_by
     OR NEW.feedback IS DISTINCT FROM OLD.feedback
     OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    RAISE EXCEPTION 'Only the lecturer can grade a submission' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.protect_assignment_submission() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS assignment_submissions_protect ON public.assignment_submissions;
CREATE TRIGGER assignment_submissions_protect
BEFORE INSERT OR UPDATE ON public.assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.protect_assignment_submission();

-- 7. Quiz questions for students, without the correct answers
DROP POLICY IF EXISTS "Students can view questions for published quizzes" ON public.quiz_questions;

CREATE OR REPLACE FUNCTION public.quiz_questions_for_student(p_quiz_id uuid)
RETURNS TABLE (id uuid, quiz_id uuid, question_text text, options jsonb, points integer, sort_order integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT qq.id, qq.quiz_id, qq.question_text, qq.options::jsonb, qq.points::integer, qq.sort_order::integer
  FROM quiz_questions qq
  JOIN quizzes q ON q.id = qq.quiz_id
  WHERE qq.quiz_id = p_quiz_id
    AND q.status = 'published'
    AND EXISTS (
      SELECT 1 FROM student_enrollments se
      WHERE se.student_id = auth.uid() AND se.course_id = q.course_id
    )
  ORDER BY qq.sort_order;
$$;
REVOKE ALL ON FUNCTION public.quiz_questions_for_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quiz_questions_for_student(uuid) TO authenticated;

-- 8. Attendance check-in rules
CREATE OR REPLACE FUNCTION public.check_attendance_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  d double precision;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  SELECT * INTO s FROM attendance_sessions WHERE id = NEW.session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance session not found' USING ERRCODE = '42501';
  END IF;

  -- The session's lecturer can record attendance for anyone
  IF s.teacher_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.student_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only check yourself in' USING ERRCODE = '42501';
  END IF;
  IF s.status <> 'open' THEN
    RAISE EXCEPTION 'This attendance session is closed' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM student_enrollments WHERE student_id = auth.uid() AND course_id = s.course_id) THEN
    RAISE EXCEPTION 'You are not registered for this course' USING ERRCODE = '42501';
  END IF;

  -- Location sessions: measure the distance here rather than trusting the browser
  IF s.latitude IS NOT NULL AND s.longitude IS NOT NULL THEN
    IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
      RAISE EXCEPTION 'Your location is needed to check in' USING ERRCODE = '42501';
    END IF;
    d := 6371000 * 2 * asin(sqrt(
      power(sin(radians(NEW.latitude - s.latitude) / 2), 2) +
      cos(radians(s.latitude)) * cos(radians(NEW.latitude)) *
      power(sin(radians(NEW.longitude - s.longitude) / 2), 2)
    ));
    IF d > COALESCE(s.allowed_radius_meters, 100) THEN
      RAISE EXCEPTION 'You are too far from the class to check in' USING ERRCODE = '42501';
    END IF;
    NEW.distance_meters := round(d);
  END IF;

  NEW.checked_in_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_attendance_checkin() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS attendance_records_check ON public.attendance_records;
CREATE TRIGGER attendance_records_check
BEFORE INSERT ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.check_attendance_checkin();

-- 9a. Enroll a student in their level's courses when approved (or when an
--     admin changes their level or department)
CREATE OR REPLACE FUNCTION public.enroll_student_in_level_courses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'student' AND NEW.status = 'approved'
     AND NEW.level_id IS NOT NULL AND NEW.department_id IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR OLD.status IS DISTINCT FROM NEW.status
          OR OLD.level_id IS DISTINCT FROM NEW.level_id
          OR OLD.department_id IS DISTINCT FROM NEW.department_id) THEN
    INSERT INTO student_enrollments (student_id, course_id)
    SELECT NEW.id, c.id FROM courses c
    WHERE c.class_id = NEW.level_id AND c.subject_id = NEW.department_id
    ON CONFLICT (student_id, course_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enroll_student_in_level_courses() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_enroll_on_approval ON public.profiles;
CREATE TRIGGER profiles_enroll_on_approval
AFTER INSERT OR UPDATE OF status, level_id, department_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enroll_student_in_level_courses();

-- 9b. Enroll existing students when a course is added to their level
CREATE OR REPLACE FUNCTION public.enroll_students_in_new_course()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.class_id IS NOT NULL AND NEW.subject_id IS NOT NULL THEN
    INSERT INTO student_enrollments (student_id, course_id)
    SELECT p.id, NEW.id FROM profiles p
    WHERE p.role = 'student' AND p.status = 'approved'
      AND p.level_id = NEW.class_id AND p.department_id = NEW.subject_id
    ON CONFLICT (student_id, course_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enroll_students_in_new_course() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS courses_enroll_students ON public.courses;
CREATE TRIGGER courses_enroll_students
AFTER INSERT ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.enroll_students_in_new_course();

-- Catch up anyone approved before this (no-op for students already enrolled)
INSERT INTO public.student_enrollments (student_id, course_id)
SELECT p.id, c.id
FROM public.profiles p
JOIN public.courses c ON c.class_id = p.level_id AND c.subject_id = p.department_id
WHERE p.role = 'student' AND p.status = 'approved'
ON CONFLICT (student_id, course_id) DO NOTHING;

COMMIT;