
-- Add is_read column to feedback table
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;

-- Add location_consent column to quiz_submissions
ALTER TABLE public.quiz_submissions ADD COLUMN IF NOT EXISTS location_consent boolean DEFAULT null;

-- Allow admins to update feedback (for marking as read)
CREATE POLICY "Admins can update feedback"
ON public.feedback
FOR UPDATE
USING (is_admin())
WITH CHECK (is_admin());

-- Allow students to update their own quiz submissions (for clearing location data)
CREATE POLICY "Students can update own location data"
ON public.quiz_submissions
FOR UPDATE
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);
