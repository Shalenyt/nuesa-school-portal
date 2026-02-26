-- Update school_settings defaults from UNIABUJA to NUESA
ALTER TABLE public.school_settings ALTER COLUMN school_name SET DEFAULT 'NUESA Portal';
ALTER TABLE public.school_settings ALTER COLUMN portal_name SET DEFAULT 'NUESA Portal';

-- Update existing rows
UPDATE public.school_settings SET 
  school_name = REPLACE(school_name, 'UNIABUJA', 'NUESA'),
  portal_name = REPLACE(COALESCE(portal_name, ''), 'UNIABUJA', 'NUESA')
WHERE school_name LIKE '%UNIABUJA%' OR portal_name LIKE '%UNIABUJA%';
