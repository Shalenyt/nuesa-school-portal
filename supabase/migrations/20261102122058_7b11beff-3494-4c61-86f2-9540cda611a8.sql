-- Users could change their own role and approval status.
--
-- The "Users can update their own profile" policy allows any column, so a new
-- applicant could verify their email, then set their own profile to
-- role = 'admin', status = 'approved' through the API and become an admin
-- without approval. The profile pages never send these fields, but the
-- database accepted them.
--
-- This trigger lets only approved admins (or the server itself, e.g. the
-- signup trigger and edge functions, where there is no signed-in user) change
-- role, approval status, department, level, matric number and staff ID.
-- Users can still edit their names, phone, address, photo and email.

BEGIN;

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No signed-in user (signup, edge functions, database jobs) or an approved admin
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- A profile created by the user themselves always starts pending
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.department_id IS DISTINCT FROM OLD.department_id
     OR NEW.level_id IS DISTINCT FROM OLD.level_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
    RAISE EXCEPTION 'Only an admin can change role, approval status, department, level, matric number or staff ID'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_protect_fields ON public.profiles;
CREATE TRIGGER profiles_protect_fields
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

COMMIT;