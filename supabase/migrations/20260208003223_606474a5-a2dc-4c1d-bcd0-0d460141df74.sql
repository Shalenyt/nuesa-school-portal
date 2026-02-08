
-- Create school_settings table
CREATE TABLE public.school_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_name TEXT NOT NULL DEFAULT 'OAUSTECH Portal',
  portal_name TEXT DEFAULT 'OAUSTECH Portal',
  logo_url TEXT,
  theme_color TEXT DEFAULT '#ef4444',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view school settings" ON public.school_settings FOR SELECT USING (true);
CREATE POLICY "Only admins can manage school settings" ON public.school_settings FOR ALL USING (is_admin());

-- Add phone and address columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- Create school-assets storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view school assets" ON storage.objects FOR SELECT USING (bucket_id = 'school-assets');
CREATE POLICY "Admins can upload school assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'school-assets' AND is_admin());
CREATE POLICY "Admins can update school assets" ON storage.objects FOR UPDATE USING (bucket_id = 'school-assets' AND is_admin());
