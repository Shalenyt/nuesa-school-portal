
-- Drop the broken SELECT policy
DROP POLICY IF EXISTS "Users can view relevant announcements" ON public.announcements;

-- Create a proper SELECT policy that:
-- 1. Uses 'general' instead of 'global'
-- 2. Lets admins see all
-- 3. Lets teachers see all announcements (they need to see admin announcements too)
-- 4. Lets students see general/urgent/academic announcements + course-specific ones
CREATE POLICY "Users can view relevant announcements"
ON public.announcements
FOR SELECT
USING (
  is_admin()
  OR is_teacher()
  OR (
    -- Students can see general, urgent, academic announcements
    type IN ('general'::announcement_type, 'urgent'::announcement_type, 'academic'::announcement_type)
  )
  OR (
    -- Students can see class/subject announcements for their enrolled courses
    type IN ('class'::announcement_type, 'subject'::announcement_type)
    AND EXISTS (
      SELECT 1 FROM student_enrollments se
      WHERE se.student_id = auth.uid()
      AND se.course_id = announcements.course_id
    )
  )
);
