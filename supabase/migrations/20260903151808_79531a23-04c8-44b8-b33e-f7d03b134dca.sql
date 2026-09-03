DROP POLICY IF EXISTS "Enrolled students and teachers can view assignments" ON public.assignments;
CREATE POLICY "Enrolled students and teachers can view assignments"
ON public.assignments FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (SELECT 1 FROM public.student_enrollments se WHERE se.student_id = auth.uid() AND se.course_id = assignments.course_id)
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.teacher_id = auth.uid() AND c.id = assignments.course_id)
);

DROP POLICY IF EXISTS "Enrolled students and teachers can view materials" ON public.materials;
CREATE POLICY "Enrolled students and teachers can view materials"
ON public.materials FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (SELECT 1 FROM public.student_enrollments se WHERE se.student_id = auth.uid() AND se.course_id = materials.course_id)
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.teacher_id = auth.uid() AND c.id = materials.course_id)
);

DROP POLICY IF EXISTS "Enrolled students can view timetable" ON public.timetable;
CREATE POLICY "Authenticated users can view timetable"
ON public.timetable FOR SELECT TO authenticated
USING (true);