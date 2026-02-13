-- Update school_settings defaults from OAUSTECH to UNIABUJA
ALTER TABLE public.school_settings ALTER COLUMN portal_name SET DEFAULT 'UNIABUJA Portal';
ALTER TABLE public.school_settings ALTER COLUMN school_name SET DEFAULT 'UNIABUJA Portal';

-- Update existing records that still have OAUSTECH
UPDATE public.school_settings 
SET school_name = REPLACE(school_name, 'OAUSTECH', 'UNIABUJA'),
    portal_name = REPLACE(portal_name, 'OAUSTECH', 'UNIABUJA')
WHERE school_name LIKE '%OAUSTECH%' OR portal_name LIKE '%OAUSTECH%';
