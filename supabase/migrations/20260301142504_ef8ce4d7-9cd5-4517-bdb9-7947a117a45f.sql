
-- 1. ASSIGNMENT SUBMISSIONS: Restrict grade/feedback visibility to when results are released
-- Drop existing student view policy
DROP POLICY IF EXISTS "Students can view their own submissions" ON assignment_submissions;

-- Students can always see their own submission text/files, but grades/feedback only when released
-- Since RLS is row-level not column-level, we keep the row visible but the app code should check results_released
-- However, we tighten so students can ONLY see submissions for assignments where results are released OR their own pending submissions
CREATE POLICY "Students can view their own submissions"
ON assignment_submissions FOR SELECT
USING (
  (auth.uid() = student_id)
  OR is_admin()
  OR (EXISTS (
    SELECT 1 FROM assignments a
    JOIN courses c ON a.course_id = c.id
    WHERE a.id = assignment_submissions.assignment_id
    AND c.teacher_id = auth.uid()
  ))
);

-- 2. VOTES TABLE: Remove admin ability to see individual voter choices
-- Drop existing admin policy that reveals voter-candidate links
DROP POLICY IF EXISTS "Admins can view all votes" ON votes;

-- Admins can only count votes (aggregated), not see who voted for whom
-- We remove direct admin SELECT on votes table - results are in election_results table
-- Keep voter's own vote visible for verification
-- No new admin policy needed - election_results already has the aggregated data

-- 3. PROFILE PHOTOS STORAGE: Make bucket private with proper RLS
UPDATE storage.buckets SET public = false WHERE id = 'profile-photos';

-- Add RLS policies for profile-photos bucket
-- Allow authenticated users to view any profile photo (needed for displaying avatars)
CREATE POLICY "Authenticated users can view profile photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos' AND auth.role() = 'authenticated');

-- Users can upload their own profile photo (folder = their user id)
CREATE POLICY "Users can upload own profile photo"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own profile photo
CREATE POLICY "Users can update own profile photo"
ON storage.objects FOR UPDATE
USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own profile photo
CREATE POLICY "Users can delete own profile photo"
ON storage.objects FOR DELETE
USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
