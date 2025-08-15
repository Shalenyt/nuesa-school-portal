-- Simplify the trigger to just handle the basic approval without HTTP calls
-- This will fix the user approval issue
CREATE OR REPLACE FUNCTION public.send_status_change_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Simply return NEW without doing HTTP calls
  -- The frontend will handle email notifications via edge functions
  RETURN NEW;
END;
$$;