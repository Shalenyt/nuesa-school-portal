
-- 1. Public verification identifier
CREATE OR REPLACE FUNCTION public.generate_public_student_id()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..10 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.public_student_id = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_student_id text;

UPDATE public.profiles
SET public_student_id = public.generate_public_student_id()
WHERE public_student_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_student_id_key
  ON public.profiles (public_student_id);

CREATE OR REPLACE FUNCTION public.set_public_student_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.public_student_id IS NULL THEN
    NEW.public_student_id := public.generate_public_student_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_public_student_id ON public.profiles;
CREATE TRIGGER profiles_set_public_student_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_public_student_id();

-- keep the identifier stable across profile edits
CREATE OR REPLACE FUNCTION public.keep_public_student_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.public_student_id IS DISTINCT FROM OLD.public_student_id AND OLD.public_student_id IS NOT NULL THEN
    NEW.public_student_id := OLD.public_student_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_keep_public_student_id ON public.profiles;
CREATE TRIGGER profiles_keep_public_student_id
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.keep_public_student_id();

-- 2. Branding fields
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS institution_name text NOT NULL DEFAULT 'University of Abuja',
  ADD COLUMN IF NOT EXISTS faculty_name text NOT NULL DEFAULT 'Engineering',
  ADD COLUMN IF NOT EXISTS organization_name text NOT NULL DEFAULT 'NUESA';

-- 3. Narrow public verification lookup (single student, approved fields only)
CREATE OR REPLACE FUNCTION public.verify_student_by_code(p_code text)
RETURNS TABLE (
  full_name text,
  matric_number text,
  profile_photo_url text,
  phone text,
  department_name text,
  faculty_name text,
  level_name text,
  institution_name text,
  organization_name text,
  logo_url text,
  is_verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.full_name,
    p.student_id,
    p.profile_photo_url,
    p.phone,
    COALESCE(s.name, 'N/A'),
    COALESCE(ss.faculty_name, 'Engineering'),
    COALESCE(c.name, 'N/A'),
    COALESCE(ss.institution_name, 'University of Abuja'),
    COALESCE(ss.organization_name, 'NUESA'),
    ss.logo_url,
    (p.status = 'approved')
  FROM public.profiles p
  LEFT JOIN public.subjects s ON p.department_id = s.id
  LEFT JOIN public.classes c ON p.level_id = c.id
  LEFT JOIN public.school_settings ss ON ss.singleton = true
  WHERE p.role = 'student'
    AND p.public_student_id = p_code
    AND length(coalesce(p_code, '')) = 10
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_student_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_student_by_code(text) TO anon, authenticated;
