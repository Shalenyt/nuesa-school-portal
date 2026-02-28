
-- 1. Fix notification INSERT policy - remove the overly permissive one
-- First check if it exists and drop it
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- 2. Create a secure view for public profile data
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id, 
  full_name, 
  department_id, 
  level_id, 
  profile_photo_url, 
  role, 
  status
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;
