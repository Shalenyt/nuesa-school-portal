-- Clear all existing school settings data to start fresh
DELETE FROM public.school_settings;

-- Insert a single default record with proper structure
INSERT INTO public.school_settings (
  id,
  school_name,
  portal_name,
  theme_color,
  logo_url,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'OAUSTECH Portal',
  'OAUSTECH Portal', 
  '#ef4444',
  null,
  now(),
  now()
);