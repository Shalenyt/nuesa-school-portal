
-- Create timetable_history table for archiving timetables
CREATE TABLE public.timetable_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  semester TEXT NOT NULL,
  session TEXT NOT NULL,
  timetable_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.timetable_history ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage timetable history"
  ON public.timetable_history FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Anyone authenticated can view
CREATE POLICY "Authenticated users can view timetable history"
  ON public.timetable_history FOR SELECT
  USING (true);
