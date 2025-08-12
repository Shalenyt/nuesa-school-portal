-- Add department and level fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN department_id uuid REFERENCES public.subjects(id),
ADD COLUMN level_id uuid REFERENCES public.classes(id);

-- Create index for better performance
CREATE INDEX idx_profiles_department_level ON public.profiles(department_id, level_id);