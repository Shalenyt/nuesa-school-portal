-- Academic sessions: each semester belongs to a session (e.g. 2026/2027)
-- and is either the First or Second semester of it. The admin page groups
-- semesters by session, lets the admin pick the current semester and edit
-- dates. Semester names stay as "<session> <First|Second> Semester" so pages
-- that read the active semester keep working unchanged.

BEGIN;

ALTER TABLE public.semester_config ADD COLUMN IF NOT EXISTS session text;
ALTER TABLE public.semester_config ADD COLUMN IF NOT EXISTS term text;

-- Name the unnamed first semester of 2025/2026
UPDATE public.semester_config
SET name = '2025/2026 First Semester', updated_at = now()
WHERE name = 'First Semester'
  AND start_date = '2025-09-10';

-- Fill session and term from names like "2025/2026 Second Semester"
UPDATE public.semester_config
SET session = substring(name from '(\d{4}/\d{4})'),
    term = CASE WHEN name ILIKE '%second%' THEN 'SECOND' ELSE 'FIRST' END
WHERE session IS NULL
  AND name ~ '\d{4}/\d{4}';

-- Second semester of 2026/2027: 1 April to 1 August 2027
INSERT INTO public.semester_config (name, session, term, start_date, end_date, is_active)
SELECT '2026/2027 Second Semester', '2026/2027', 'SECOND', '2027-04-01', '2027-08-01', false
WHERE NOT EXISTS (
  SELECT 1 FROM public.semester_config WHERE session = '2026/2027' AND term = 'SECOND'
);

-- A semester must start before it ends
ALTER TABLE public.semester_config DROP CONSTRAINT IF EXISTS semester_dates_in_order;
ALTER TABLE public.semester_config
  ADD CONSTRAINT semester_dates_in_order CHECK (start_date < end_date);

-- Only First or Second, and at most one of each per session
ALTER TABLE public.semester_config DROP CONSTRAINT IF EXISTS semester_term_valid;
ALTER TABLE public.semester_config
  ADD CONSTRAINT semester_term_valid CHECK (term IS NULL OR term IN ('FIRST', 'SECOND'));

ALTER TABLE public.semester_config DROP CONSTRAINT IF EXISTS semester_one_term_per_session;
ALTER TABLE public.semester_config
  ADD CONSTRAINT semester_one_term_per_session UNIQUE (session, term);

COMMIT;
