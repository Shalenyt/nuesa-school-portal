ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS middle_name text;

UPDATE public.profiles p
SET
  first_name = COALESCE(p.first_name, NULLIF(split_part(btrim(p.full_name), ' ', 1), '')),
  last_name = COALESCE(
    p.last_name,
    CASE
      WHEN array_length(regexp_split_to_array(btrim(p.full_name), '\s+'), 1) > 1
      THEN (regexp_split_to_array(btrim(p.full_name), '\s+'))[array_length(regexp_split_to_array(btrim(p.full_name), '\s+'), 1)]
      ELSE NULL
    END
  ),
  middle_name = COALESCE(
    p.middle_name,
    CASE
      WHEN array_length(regexp_split_to_array(btrim(p.full_name), '\s+'), 1) > 2
      THEN array_to_string((regexp_split_to_array(btrim(p.full_name), '\s+'))[2:array_length(regexp_split_to_array(btrim(p.full_name), '\s+'), 1) - 1], ' ')
      ELSE NULL
    END
  )
WHERE p.full_name IS NOT NULL AND btrim(p.full_name) <> '';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_first text := NULLIF(btrim(COALESCE(new.raw_user_meta_data->>'first_name', '')), '');
  v_last text := NULLIF(btrim(COALESCE(new.raw_user_meta_data->>'last_name', '')), '');
  v_middle text := NULLIF(btrim(COALESCE(new.raw_user_meta_data->>'middle_name', '')), '');
  v_full text := NULLIF(btrim(COALESCE(new.raw_user_meta_data->>'full_name', '')), '');
BEGIN
  IF v_full IS NULL THEN
    v_full := btrim(concat_ws(' ', v_last, v_first, v_middle));
  END IF;

  IF v_first IS NULL AND v_full IS NOT NULL THEN
    v_first := NULLIF(split_part(v_full, ' ', 1), '');
  END IF;

  INSERT INTO public.profiles (id, full_name, first_name, last_name, middle_name, email, role, student_id, staff_id, department_id, level_id)
  VALUES (
    new.id,
    COALESCE(v_full, ''),
    v_first,
    v_last,
    v_middle,
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
$function$;