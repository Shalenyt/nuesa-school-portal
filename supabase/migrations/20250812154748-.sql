-- Drop and recreate assignment submissions policies with proper checks
DROP POLICY IF EXISTS "Students can insert their own submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Students can update their own ungraded submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Students can view their own submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Teachers can grade submissions for their courses" ON assignment_submissions;

-- Allow students to insert submissions (simplified check)
CREATE POLICY "Students can insert submissions" 
ON assignment_submissions 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  student_id = auth.uid()
);

-- Allow students to view their own submissions
CREATE POLICY "Students can view their own submissions" 
ON assignment_submissions 
FOR SELECT 
USING (
  student_id = auth.uid() OR 
  is_admin() OR 
  (EXISTS (
    SELECT 1 FROM assignments a
    JOIN courses c ON a.course_id = c.id
    WHERE a.id = assignment_submissions.assignment_id AND c.teacher_id = auth.uid()
  ))
);

-- Allow students to update their own ungraded submissions
CREATE POLICY "Students can update their own ungraded submissions" 
ON assignment_submissions 
FOR UPDATE 
USING (student_id = auth.uid() AND grade IS NULL);

-- Allow teachers to grade submissions for their courses
CREATE POLICY "Teachers can grade submissions" 
ON assignment_submissions 
FOR UPDATE 
USING (
  is_admin() OR 
  (EXISTS (
    SELECT 1 FROM assignments a
    JOIN courses c ON a.course_id = c.id
    WHERE a.id = assignment_submissions.assignment_id AND c.teacher_id = auth.uid()
  ))
);