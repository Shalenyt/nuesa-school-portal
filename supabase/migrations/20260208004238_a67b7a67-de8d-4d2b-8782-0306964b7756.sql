
-- Delete all duplicate rows, keeping only the first one with the logo
DELETE FROM public.school_settings WHERE id != 'ea218149-452c-4c7f-8c29-1797e9b41d39';

-- Add a unique constraint to prevent multiple rows (only one settings row should exist)
-- We use a dummy column trick: add a column that's always true, with a unique constraint
ALTER TABLE public.school_settings ADD COLUMN IF NOT EXISTS singleton BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.school_settings ADD CONSTRAINT school_settings_singleton UNIQUE (singleton);
ALTER TABLE public.school_settings ADD CONSTRAINT school_settings_singleton_check CHECK (singleton = true);
