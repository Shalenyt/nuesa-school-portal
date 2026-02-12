
-- Batch A: Grade Control - Add grade locking and result release to quizzes and assignments
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS grades_locked boolean DEFAULT false;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS results_released boolean DEFAULT false;

ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS grades_locked boolean DEFAULT false;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS results_released boolean DEFAULT false;

-- Grade audit logs
CREATE TABLE public.grade_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id UUID NOT NULL,
  action text NOT NULL,
  performed_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.grade_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and teachers can view audit logs"
  ON public.grade_audit_logs FOR SELECT
  USING (is_admin() OR is_teacher());

CREATE POLICY "Admins and teachers can insert audit logs"
  ON public.grade_audit_logs FOR INSERT
  WITH CHECK (is_admin() OR is_teacher());

-- Batch F: Semester Configuration
CREATE TABLE public.semester_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.semester_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view semester config"
  ON public.semester_config FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage semester config"
  ON public.semester_config FOR ALL
  USING (is_admin());

-- Batch F: High Priority Notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS acknowledged boolean DEFAULT false;

-- Allow users to delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);
