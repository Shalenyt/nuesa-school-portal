-- Drop the unique constraint that prevents resubmissions
ALTER TABLE public.assignment_submissions DROP CONSTRAINT assignment_submissions_assignment_id_student_id_key;