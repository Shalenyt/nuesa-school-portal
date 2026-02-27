
-- Allow teachers to delete quiz submissions for their quizzes
CREATE POLICY "Teachers can delete submissions for their quizzes"
ON public.quiz_submissions
FOR DELETE
USING (
  is_admin() OR (EXISTS (
    SELECT 1 FROM quizzes q
    WHERE q.id = quiz_submissions.quiz_id AND q.created_by = auth.uid()
  ))
);

-- Allow teachers to delete violation logs for their quizzes
CREATE POLICY "Teachers can delete violations for their quizzes"
ON public.quiz_violation_logs
FOR DELETE
USING (
  is_admin() OR (EXISTS (
    SELECT 1 FROM quizzes q
    WHERE q.id = quiz_violation_logs.quiz_id AND q.created_by = auth.uid()
  ))
);

-- Allow teachers to delete attendance records for their sessions
CREATE POLICY "Teachers can delete attendance records for their sessions"
ON public.attendance_records
FOR DELETE
USING (
  is_admin() OR (EXISTS (
    SELECT 1 FROM attendance_sessions a_s
    WHERE a_s.id = attendance_records.session_id AND a_s.teacher_id = auth.uid()
  ))
);
