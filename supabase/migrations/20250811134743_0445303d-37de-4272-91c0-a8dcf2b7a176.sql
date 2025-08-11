-- Approve the first admin account (replace with actual email if different)
UPDATE public.profiles 
SET status = 'approved' 
WHERE email = 'momohnajib@gmail.com' AND role = 'admin';

-- Also auto-approve admin accounts in the future by updating the trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'student'),
    CASE 
      WHEN COALESCE((new.raw_user_meta_data->>'role')::user_role, 'student') = 'admin' THEN 'approved'::application_status
      ELSE 'pending'::application_status
    END
  );
  RETURN new;
END;
$function$;