-- Clear notifications from the testing period (February to August 2026):
-- test quizzes, attendance sessions, assignments, grades and the test
-- election. All of them point at test data that has already been removed.
-- Anything created from 2 November 2026 onwards is kept.
DELETE FROM public.notifications
WHERE created_at < '2026-11-02 00:00:00+01';
