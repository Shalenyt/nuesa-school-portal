
-- =====================================================
-- 1. FIX RLS SECURITY VULNERABILITIES
-- =====================================================

-- Remove overly permissive policies
DROP POLICY IF EXISTS "Public can verify student profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view payments" ON public.payments;

-- Create a security definer function for public student verification (limited data only)
CREATE OR REPLACE FUNCTION public.verify_student_public(student_matric text)
RETURNS TABLE(full_name text, student_id text, profile_photo_url text, department_name text, level_name text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.full_name, p.student_id, p.profile_photo_url,
         COALESCE(s.name, 'N/A'), COALESCE(c.name, 'N/A'), p.status::text
  FROM profiles p
  LEFT JOIN subjects s ON p.department_id = s.id
  LEFT JOIN classes c ON p.level_id = c.id
  WHERE p.student_id = student_matric
    AND p.role = 'student'
    AND p.status = 'approved'
  LIMIT 1;
$$;

-- Payments: only authenticated users with proper roles can view
CREATE POLICY "Authenticated users can view relevant payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  is_admin()
  OR (
    -- Students see payments targeted to them (by visibility, department, level)
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student')
    AND (
      visibility = 'all'
      OR (department_id IS NOT NULL AND department_id = (SELECT department_id FROM profiles WHERE id = auth.uid()))
      OR (level_id IS NOT NULL AND level_id = (SELECT level_id FROM profiles WHERE id = auth.uid()))
    )
  )
  OR (
    -- Teachers see payments for their department
    is_teacher()
    AND (
      visibility = 'all'
      OR department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    )
  )
);

-- =====================================================
-- 2. VOTING SYSTEM TABLES
-- =====================================================

-- Electoral positions
CREATE TABLE public.electoral_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  voting_open BOOLEAN NOT NULL DEFAULT false,
  voting_end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.electoral_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view published positions"
ON public.electoral_positions FOR SELECT TO authenticated
USING (published = true OR is_admin());

CREATE POLICY "Admins can manage positions"
ON public.electoral_positions FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

-- Candidates
CREATE TABLE public.candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES public.electoral_positions(id) ON DELETE CASCADE,
  manifesto TEXT,
  profile_pic TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, position_id)
);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View approved candidates or own applications"
ON public.candidates FOR SELECT TO authenticated
USING (approved = true OR student_id = auth.uid() OR is_admin());

CREATE POLICY "Students can apply"
ON public.candidates FOR INSERT TO authenticated
WITH CHECK (auth.uid() = student_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student' AND status = 'approved'));

CREATE POLICY "Admins can manage candidates"
ON public.candidates FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Students can update own pending application"
ON public.candidates FOR UPDATE TO authenticated
USING (student_id = auth.uid() AND approved = false);

-- Votes
CREATE TABLE public.votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES public.electoral_positions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(voter_id, position_id)
);

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can vote once per position"
ON public.votes FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = voter_id
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student' AND status = 'approved')
);

CREATE POLICY "Admins can view all votes"
ON public.votes FOR SELECT TO authenticated
USING (is_admin());

CREATE POLICY "Voters can see own votes"
ON public.votes FOR SELECT TO authenticated
USING (voter_id = auth.uid());

-- Add signature columns to school_settings for receipt
ALTER TABLE public.school_settings
ADD COLUMN IF NOT EXISTS president_signature_url TEXT,
ADD COLUMN IF NOT EXISTS financial_secretary_signature_url TEXT;

-- Triggers for updated_at
CREATE TRIGGER update_electoral_positions_updated_at BEFORE UPDATE ON public.electoral_positions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
