-- Site review fixes (November 2026)

-- 1. Remove the old public lookup by matric number.
--    Matric numbers follow a pattern, so anyone could list every approved
--    student's name, photo, department and level through it. ID cards and the
--    /verify pages now use the random 10-character public code only.
DROP FUNCTION IF EXISTS public.verify_student_public(text);

-- 2. The public verify page no longer shows the student's phone number.
--    Same function and columns as before; phone is just returned empty.
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
    NULL::text,
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

-- 3. Names of lecturers and admins for signed-in users.
--    Students couldn't read lecturer profiles and lecturers couldn't read the
--    admin's, so courses showed "Instructor: Pending" and announcements had
--    no author. This returns only id, full name and role (no email or phone).
CREATE OR REPLACE FUNCTION public.get_staff_names()
RETURNS TABLE (id uuid, full_name text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.role::text
  FROM public.profiles p
  WHERE p.role IN ('teacher', 'admin');
$$;

REVOKE ALL ON FUNCTION public.get_staff_names() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_names() TO authenticated;

-- 4. Anonymous feedback is stored without the sender's id.
--    Previously the page hid the name but the database kept user_id, so
--    anyone with database access could trace an "anonymous" complaint.
ALTER TABLE public.feedback ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "Users can submit feedback" ON public.feedback;
CREATE POLICY "Users can submit feedback"
ON public.feedback FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR (is_anonymous = true AND user_id IS NULL)
);
