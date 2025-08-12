-- Fix assignment submissions RLS policy
DROP POLICY IF EXISTS "Students can insert their own submissions" ON assignment_submissions;
CREATE POLICY "Students can insert their own submissions" 
ON assignment_submissions 
FOR INSERT 
WITH CHECK (auth.uid() = student_id);

-- Fix assignment submissions update policy for students
DROP POLICY IF EXISTS "Students can update their own submissions" ON assignment_submissions;
CREATE POLICY "Students can update their own ungraded submissions" 
ON assignment_submissions 
FOR UPDATE 
USING (auth.uid() = student_id AND grade IS NULL);

-- Ensure teachers can grade submissions
DROP POLICY IF EXISTS "Teachers can grade submissions for their courses" ON assignment_submissions;
CREATE POLICY "Teachers can grade submissions for their courses" 
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