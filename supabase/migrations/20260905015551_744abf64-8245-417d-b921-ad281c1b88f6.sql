
REVOKE ALL ON FUNCTION public.generate_public_student_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_public_student_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.keep_public_student_id() FROM PUBLIC, anon, authenticated;
