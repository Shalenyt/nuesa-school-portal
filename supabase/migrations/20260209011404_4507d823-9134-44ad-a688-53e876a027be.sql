
-- Fix classes SELECT policy: drop restrictive, create permissive
DROP POLICY IF EXISTS "Anyone can view classes" ON public.classes;
CREATE POLICY "Anyone can view classes" ON public.classes
  FOR SELECT TO anon, authenticated
  USING (true);

-- Fix subjects SELECT policy: drop restrictive, create permissive
DROP POLICY IF EXISTS "Anyone can view subjects" ON public.subjects;
CREATE POLICY "Anyone can view subjects" ON public.subjects
  FOR SELECT TO anon, authenticated
  USING (true);

-- Fix courses SELECT policy: drop restrictive, create permissive
DROP POLICY IF EXISTS "Anyone can view courses" ON public.courses;
CREATE POLICY "Anyone can view courses" ON public.courses
  FOR SELECT TO anon, authenticated
  USING (true);

-- Fix school_settings SELECT policy too
DROP POLICY IF EXISTS "Anyone can view school settings" ON public.school_settings;
CREATE POLICY "Anyone can view school settings" ON public.school_settings
  FOR SELECT TO anon, authenticated
  USING (true);
