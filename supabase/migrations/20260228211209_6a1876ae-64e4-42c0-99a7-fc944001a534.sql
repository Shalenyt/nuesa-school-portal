
-- Fix the security definer view warning by using SECURITY INVOKER
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT 
  id, 
  full_name, 
  department_id, 
  level_id, 
  profile_photo_url, 
  role, 
  status
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;
