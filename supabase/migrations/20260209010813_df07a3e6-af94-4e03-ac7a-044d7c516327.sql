
-- 1. Add missing columns to courses table
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS credit_unit INTEGER DEFAULT 1;

-- 2. Add department_id and level_id to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.subjects(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level_id UUID REFERENCES public.classes(id);

-- 3. Update the handle_new_user trigger to save all fields during signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, student_id, staff_id, department_id, level_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'student'),
    new.raw_user_meta_data->>'student_id',
    new.raw_user_meta_data->>'staff_id',
    CASE 
      WHEN new.raw_user_meta_data->>'subjectId' IS NOT NULL AND new.raw_user_meta_data->>'subjectId' != '' 
      THEN (new.raw_user_meta_data->>'subjectId')::UUID 
      ELSE NULL 
    END,
    CASE 
      WHEN new.raw_user_meta_data->>'classId' IS NOT NULL AND new.raw_user_meta_data->>'classId' != '' 
      THEN (new.raw_user_meta_data->>'classId')::UUID 
      ELSE NULL 
    END
  );
  RETURN new;
END;
$$;
