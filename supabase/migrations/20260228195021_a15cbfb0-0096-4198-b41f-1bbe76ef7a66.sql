
-- 1. Add attendance_type to attendance_sessions
ALTER TABLE public.attendance_sessions ADD COLUMN IF NOT EXISTS attendance_type text NOT NULL DEFAULT 'gps';

-- 2. Create exam_timetables table
CREATE TABLE public.exam_timetables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_label text NOT NULL,
  exam_date date NOT NULL,
  time_slot text NOT NULL CHECK (time_slot IN ('morning', 'afternoon', 'evening')),
  start_time time NOT NULL,
  end_time time NOT NULL,
  course_code text NOT NULL,
  venue text,
  department_id uuid REFERENCES public.subjects(id),
  level_id uuid REFERENCES public.classes(id),
  created_by uuid REFERENCES public.profiles(id) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_timetables ENABLE ROW LEVEL SECURITY;

-- Admin full CRUD
CREATE POLICY "Admins can manage exam timetables"
ON public.exam_timetables FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Everyone authenticated can view
CREATE POLICY "Authenticated users can view exam timetables"
ON public.exam_timetables FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_exam_timetables_updated_at
BEFORE UPDATE ON public.exam_timetables
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
