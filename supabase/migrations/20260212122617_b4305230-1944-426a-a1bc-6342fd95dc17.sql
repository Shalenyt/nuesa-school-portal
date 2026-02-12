
-- Step 2: Migrate existing 'global' announcements to 'general' and update default
UPDATE public.announcements SET type = 'general' WHERE type = 'global';
ALTER TABLE public.announcements ALTER COLUMN type SET DEFAULT 'general'::announcement_type;
