-- Add portal_name and theme_color columns to school_settings table
ALTER TABLE public.school_settings 
ADD COLUMN portal_name TEXT DEFAULT 'OAUSTECH Portal',
ADD COLUMN theme_color TEXT DEFAULT '#ef4444';