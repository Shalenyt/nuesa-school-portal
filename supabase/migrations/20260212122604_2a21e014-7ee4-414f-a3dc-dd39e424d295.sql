
-- Step 1: Add new enum values only
ALTER TYPE public.announcement_type ADD VALUE IF NOT EXISTS 'general';
ALTER TYPE public.announcement_type ADD VALUE IF NOT EXISTS 'urgent';
ALTER TYPE public.announcement_type ADD VALUE IF NOT EXISTS 'academic';
