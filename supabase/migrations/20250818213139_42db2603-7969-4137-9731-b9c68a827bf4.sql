-- Backfill missing student_id and staff_id from application data
-- Update students who don't have student_id set but should have it
UPDATE profiles 
SET student_id = id::text
WHERE role = 'student' 
  AND status = 'approved' 
  AND (student_id IS NULL OR student_id = '');

-- Update teachers who don't have staff_id set but should have it  
UPDATE profiles 
SET staff_id = id::text
WHERE role = 'teacher' 
  AND status = 'approved' 
  AND (staff_id IS NULL OR staff_id = '');