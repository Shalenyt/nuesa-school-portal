
-- Fix 1: Restrict notifications INSERT to admin-only (prevent spam/phishing)
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "Only admins can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Fix 2: Tighten profiles SELECT policy to role-based access
DROP POLICY IF EXISTS "Users can view all approved profiles" ON public.profiles;

-- Users can always see their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- Admins can see all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Teachers can see students enrolled in their courses
CREATE POLICY "Teachers can view enrolled students" ON public.profiles
  FOR SELECT USING (
    status = 'approved' AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    ) AND
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.student_enrollments se ON c.id = se.course_id
      WHERE c.teacher_id = auth.uid() AND se.student_id = profiles.id
    )
  );

-- Students can see their teachers and classmates (limited)
CREATE POLICY "Students can view classmates and teachers" ON public.profiles
  FOR SELECT USING (
    status = 'approved' AND
    role IN ('teacher', 'student') AND
    EXISTS (
      SELECT 1 FROM public.student_enrollments se1
      JOIN public.student_enrollments se2 ON se1.course_id = se2.course_id
      WHERE se1.student_id = auth.uid() AND se2.student_id = profiles.id
    )
  );
