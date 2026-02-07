
-- Fix recursive profiles policies by using security definer functions
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Teachers can view enrolled students" ON public.profiles;
CREATE POLICY "Teachers can view enrolled students" ON public.profiles
  FOR SELECT USING (
    status = 'approved' AND
    is_teacher() AND
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.student_enrollments se ON c.id = se.course_id
      WHERE c.teacher_id = auth.uid() AND se.student_id = profiles.id
    )
  );
