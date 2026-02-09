
-- 1. Create course_lists table
CREATE TABLE IF NOT EXISTS public.course_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  course_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.course_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view course_lists" ON public.course_lists
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can manage course_lists" ON public.course_lists
  FOR ALL USING (is_admin());

-- 2. Fix duplicate key constraint: drop the old one and add name to uniqueness
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_class_id_subject_id_semester_academic_year_key;
ALTER TABLE public.courses ADD CONSTRAINT courses_unique_per_name_class_subject_semester_year
  UNIQUE (name, class_id, subject_id, semester, academic_year);

-- 3. Fix timetable RLS: allow teachers to manage schedules for their courses
CREATE POLICY "Teachers can insert timetable for their courses" ON public.timetable
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update timetable for their courses" ON public.timetable
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete timetable for their courses" ON public.timetable
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.teacher_id = auth.uid()
    )
  );

-- 4. Allow students to enroll themselves (needed for auto-enrollment)
CREATE POLICY "Students can enroll themselves" ON public.student_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);
