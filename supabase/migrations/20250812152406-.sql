-- Fix RLS policies to allow students to see data based on course lists rather than enrollments

-- Update materials policy for students
DROP POLICY IF EXISTS "Enrolled students and teachers can view materials" ON materials;
CREATE POLICY "Students and teachers can view materials for their courses" 
ON materials 
FOR SELECT 
USING (
  is_admin() OR 
  (EXISTS (
    SELECT 1 FROM courses c 
    WHERE c.teacher_id = auth.uid() AND c.id = materials.course_id
  )) OR
  (EXISTS (
    SELECT 1 FROM profiles p
    JOIN course_lists cl ON cl.class_id = p.level_id AND cl.subject_id = p.department_id
    WHERE p.id = auth.uid() AND materials.course_id = ANY(cl.course_ids)
  ))
);

-- Update assignments policy for students  
DROP POLICY IF EXISTS "Enrolled students and teachers can view assignments" ON assignments;
CREATE POLICY "Students and teachers can view assignments for their courses"
ON assignments 
FOR SELECT 
USING (
  is_admin() OR 
  (EXISTS (
    SELECT 1 FROM courses c 
    WHERE c.teacher_id = auth.uid() AND c.id = assignments.course_id
  )) OR
  (EXISTS (
    SELECT 1 FROM profiles p
    JOIN course_lists cl ON cl.class_id = p.level_id AND cl.subject_id = p.department_id
    WHERE p.id = auth.uid() AND assignments.course_id = ANY(cl.course_ids)
  ))
);

-- Update timetable policy for students
DROP POLICY IF EXISTS "Enrolled students can view timetable" ON timetable;
CREATE POLICY "Students and teachers can view timetable for their courses"
ON timetable 
FOR SELECT 
USING (
  is_admin() OR 
  (EXISTS (
    SELECT 1 FROM courses c 
    WHERE c.teacher_id = auth.uid() AND c.id = timetable.course_id
  )) OR
  (EXISTS (
    SELECT 1 FROM profiles p
    JOIN course_lists cl ON cl.class_id = p.level_id AND cl.subject_id = p.department_id
    WHERE p.id = auth.uid() AND timetable.course_id = ANY(cl.course_ids)
  ))
);