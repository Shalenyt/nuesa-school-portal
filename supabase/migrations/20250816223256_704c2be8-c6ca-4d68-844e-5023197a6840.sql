-- Fix the handle_new_user function to properly map level_id and department_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    full_name, 
    email, 
    role, 
    status,
    student_id,
    staff_id,
    level_id,
    department_id
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'student'),
    CASE 
      WHEN COALESCE((new.raw_user_meta_data->>'role')::user_role, 'student') = 'admin' THEN 'approved'::application_status
      ELSE 'pending'::application_status
    END,
    new.raw_user_meta_data->>'student_id',
    new.raw_user_meta_data->>'staff_id',
    CASE 
      WHEN new.raw_user_meta_data->>'classId' IS NOT NULL 
      THEN (new.raw_user_meta_data->>'classId')::uuid
      ELSE NULL
    END,
    CASE 
      WHEN new.raw_user_meta_data->>'subjectId' IS NOT NULL 
      THEN (new.raw_user_meta_data->>'subjectId')::uuid
      ELSE NULL
    END
  );
  RETURN new;
END;
$$;

-- Fix the send_approval_notification function to properly trigger email notifications
CREATE OR REPLACE FUNCTION public.send_approval_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  -- Only send if status changed
  IF OLD.status != NEW.status THEN
    -- Create an in-app notification for approved users
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        NEW.id,
        'Welcome to OAUSTECH Portal!',
        'Your account has been approved. Welcome to the portal!',
        'success'
      );
    END IF;
    
    -- For role promotions (when role changes to admin)
    IF OLD.role != NEW.role AND NEW.role = 'admin' THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        NEW.id,
        'Role Promotion!',
        'You have been promoted to Administrator role!',
        'success'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;