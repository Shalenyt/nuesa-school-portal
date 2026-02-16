
-- 1. Announcement reads tracking (per-user read state for urgent announcements)
CREATE TABLE public.announcement_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own reads" ON public.announcement_reads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reads" ON public.announcement_reads FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. Add department_id and level_id to announcements for targeted delivery
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.subjects(id);
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS level_id UUID REFERENCES public.classes(id);

-- 3. Payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'general',
  department_id UUID REFERENCES public.subjects(id),
  level_id UUID REFERENCES public.classes(id),
  course_id UUID REFERENCES public.courses(id),
  due_date DATE,
  late_penalty NUMERIC(12,2) DEFAULT 0,
  allow_partial BOOLEAN DEFAULT false,
  visibility TEXT NOT NULL DEFAULT 'all',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage payments" ON public.payments FOR ALL USING (is_admin());
CREATE POLICY "Anyone can view payments" ON public.payments FOR SELECT USING (true);

-- 4. Payment records (student payments)
CREATE TABLE public.payment_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  amount_paid NUMERIC(12,2) NOT NULL,
  reference TEXT NOT NULL,
  receipt_number TEXT NOT NULL,
  payment_method TEXT DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'paid',
  paid_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified_by UUID REFERENCES public.profiles(id),
  UNIQUE(payment_id, student_id)
);
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own payments" ON public.payment_records FOR SELECT USING (auth.uid() = student_id OR is_admin());
CREATE POLICY "Students can insert own payments" ON public.payment_records FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Admins can manage payment records" ON public.payment_records FOR ALL USING (is_admin());

-- 5. Public profile access for QR verification (anon can verify students)
CREATE POLICY "Public can verify student profiles" ON public.profiles FOR SELECT USING (role = 'student' AND status = 'approved');

-- 6. Trigger for payments updated_at
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
