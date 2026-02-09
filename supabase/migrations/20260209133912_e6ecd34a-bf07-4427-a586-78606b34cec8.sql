
-- Add GPS location columns to attendance_sessions
ALTER TABLE public.attendance_sessions
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision,
ADD COLUMN IF NOT EXISTS allowed_radius_meters integer DEFAULT 100;

-- Add GPS location columns to attendance_records
ALTER TABLE public.attendance_records
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision,
ADD COLUMN IF NOT EXISTS distance_meters double precision;

-- Allow teachers to insert notifications (for quiz/attendance notifications)
CREATE POLICY "Teachers can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
));
