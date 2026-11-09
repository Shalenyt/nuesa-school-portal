-- Email change now goes through Supabase's own 6-digit code check instead of
-- the change-email function switching the address with no confirmation.
--
-- When the address in auth.users actually changes (only after the code is
-- accepted), keep profiles.email in step and record the change so the
-- change-email function can notify the old and new addresses. The log has no
-- access rules for users: only the server reads it.

BEGIN;

CREATE TABLE IF NOT EXISTS public.email_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  old_email text,
  new_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);
CREATE INDEX IF NOT EXISTS email_change_log_user_id_idx ON public.email_change_log (user_id, created_at DESC);
ALTER TABLE public.email_change_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_change_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_auth_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    INSERT INTO public.email_change_log (user_id, old_email, new_email)
    VALUES (NEW.id, OLD.email, NEW.email);
    UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_auth_email_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_auth_email_change();

COMMIT;
