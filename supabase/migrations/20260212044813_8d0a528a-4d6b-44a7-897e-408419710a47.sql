
-- ==========================================
-- 1. GPS Quiz Restriction - Add columns to quizzes table
-- ==========================================
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS gps_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision,
ADD COLUMN IF NOT EXISTS allowed_radius_meters integer DEFAULT 100;

-- ==========================================
-- 2. Push Notification Subscriptions
-- ==========================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push subscriptions"
ON public.push_subscriptions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and teachers can read push subscriptions"
ON public.push_subscriptions FOR SELECT
USING (is_admin() OR is_teacher());

-- ==========================================
-- 3. Quiz Violation Logs (anti-cheat)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.quiz_violation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  violation_type text NOT NULL, -- 'tab_switch', 'focus_loss', 'fullscreen_exit', 'copy_attempt', 'devtools_open'
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_violation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can insert their own violations"
ON public.quiz_violation_logs FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can view their own violations"
ON public.quiz_violation_logs FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Teachers can view violations for their quizzes"
ON public.quiz_violation_logs FOR SELECT
USING (is_admin() OR EXISTS (
  SELECT 1 FROM quizzes q WHERE q.id = quiz_violation_logs.quiz_id AND q.created_by = auth.uid()
));

-- ==========================================
-- 4. Device info on quiz submissions
-- ==========================================
ALTER TABLE public.quiz_submissions
ADD COLUMN IF NOT EXISTS device_info jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS ip_address text,
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision,
ADD COLUMN IF NOT EXISTS tab_switch_count integer DEFAULT 0;

-- Index for faster violation lookups
CREATE INDEX IF NOT EXISTS idx_quiz_violations_quiz_student 
ON public.quiz_violation_logs(quiz_id, student_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user 
ON public.push_subscriptions(user_id);
