
-- Receipt templates table for storing uploaded receipt images per payment type
CREATE TABLE public.receipt_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_type text NOT NULL UNIQUE,
  template_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.receipt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view receipt templates" ON public.receipt_templates FOR SELECT USING (true);
CREATE POLICY "Admins can manage receipt templates" ON public.receipt_templates FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Election results table for storing computed results
CREATE TABLE public.election_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id uuid NOT NULL REFERENCES public.electoral_positions(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  vote_count integer NOT NULL DEFAULT 0,
  is_winner boolean NOT NULL DEFAULT false,
  calculated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.election_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view results" ON public.election_results FOR SELECT USING (true);
CREATE POLICY "System/admins can manage results" ON public.election_results FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Add election_status column for clearer state tracking
ALTER TABLE public.electoral_positions ADD COLUMN IF NOT EXISTS election_status text NOT NULL DEFAULT 'draft';
