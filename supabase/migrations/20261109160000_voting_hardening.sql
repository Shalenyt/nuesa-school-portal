-- Voting: department elections, rules enforced by the database, live tallies,
-- safe closing (manual and scheduled), and indexes for load.
--
-- Fixes found in the November 2026 review:
-- * Admins could not read votes, so admin results, voter lists and exports
--   always showed 0. Students could only read their own vote, so their live
--   results showed 0 or 1. Tallies now come from election_tallies().
-- * Votes were only checked in the browser: a vote could be cast while voting
--   was closed or after the end time, for an unapproved candidate, or for a
--   candidate of another position. Students could also submit an application
--   that was already approved. Triggers now check all of this.
-- * Positions had no department, so a departmental election was open to
--   every student. electoral_positions.department_id (NULL = all).
-- * Scheduled closing only ran while an admin had the Voting page open.
--   close_expired_elections() can be called by any signed-in page, and votes
--   after the end time are refused regardless.
-- * Closing was not atomic and could miss votes cast during the close, named
--   one winner on a tie, and notified every user. close_election() locks the
--   position, counts in one query, records ties, and notifies eligible voters.

BEGIN;

-- Department of an election (NULL = open to every department)
ALTER TABLE public.electoral_positions
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;

-- Indexes for counting and lookups under load
CREATE INDEX IF NOT EXISTS votes_position_candidate_idx ON public.votes (position_id, candidate_id);
CREATE INDEX IF NOT EXISTS candidates_position_idx ON public.candidates (position_id);
CREATE INDEX IF NOT EXISTS election_results_position_idx ON public.election_results (position_id);

-- Can the signed-in user take part in this position's election?
CREATE OR REPLACE FUNCTION public.can_access_position(p_position_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM electoral_positions ep
    WHERE ep.id = p_position_id
      AND ep.published
      AND (ep.department_id IS NULL OR ep.department_id = (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      ))
  );
$$;
REVOKE ALL ON FUNCTION public.can_access_position(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_position(uuid) TO authenticated;

-- Positions: students see published elections for their department
DROP POLICY IF EXISTS "Anyone authenticated can view published positions" ON public.electoral_positions;
DROP POLICY IF EXISTS "View published positions for own department" ON public.electoral_positions;
CREATE POLICY "View published positions for own department"
ON public.electoral_positions FOR SELECT TO authenticated
USING (
  public.is_admin() OR (
    published AND (department_id IS NULL OR department_id = (
      SELECT department_id FROM public.profiles WHERE id = auth.uid()
    ))
  )
);

-- Admins can read votes (results, voter lists, exports)
DROP POLICY IF EXISTS "Admins can view votes" ON public.votes;
CREATE POLICY "Admins can view votes"
ON public.votes FOR SELECT TO authenticated
USING (public.is_admin());

-- A closed election stays closed; voting needs a published position
CREATE OR REPLACE FUNCTION public.guard_electoral_position()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.election_status = 'closed' THEN
    IF NEW.voting_open OR NEW.election_status <> 'closed' THEN
      RAISE EXCEPTION 'This election is closed and cannot be reopened' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NEW.voting_open AND NOT NEW.published THEN
    RAISE EXCEPTION 'Publish the position before opening voting' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS electoral_positions_guard ON public.electoral_positions;
CREATE TRIGGER electoral_positions_guard
BEFORE INSERT OR UPDATE ON public.electoral_positions
FOR EACH ROW EXECUTE FUNCTION public.guard_electoral_position();

-- Candidate applications
CREATE OR REPLACE FUNCTION public.check_candidate_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pos record;
  dept uuid;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.approved IS DISTINCT FROM OLD.approved
       OR NEW.position_id IS DISTINCT FROM OLD.position_id
       OR NEW.student_id IS DISTINCT FROM OLD.student_id THEN
      RAISE EXCEPTION 'Only an admin can change this application' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  NEW.approved := false;

  SELECT * INTO pos FROM electoral_positions WHERE id = NEW.position_id;
  IF NOT FOUND OR NOT pos.published THEN
    RAISE EXCEPTION 'This position is not open for applications' USING ERRCODE = '42501';
  END IF;
  IF pos.election_status = 'closed' OR pos.voting_open THEN
    RAISE EXCEPTION 'Applications for this position have closed' USING ERRCODE = '42501';
  END IF;
  SELECT department_id INTO dept FROM profiles WHERE id = auth.uid();
  IF pos.department_id IS NOT NULL AND dept IS DISTINCT FROM pos.department_id THEN
    RAISE EXCEPTION 'This election is only for students of its department' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_candidate_application() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS candidates_check_application ON public.candidates;
CREATE TRIGGER candidates_check_application
BEFORE INSERT OR UPDATE ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.check_candidate_application();

-- Votes
CREATE OR REPLACE FUNCTION public.check_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pos record;
  cand record;
  dept uuid;
BEGIN
  -- Share-lock the position: a close in progress (which takes an update lock)
  -- makes votes wait, then they see it closed and are refused. Votes do not
  -- block each other.
  SELECT * INTO pos FROM electoral_positions WHERE id = NEW.position_id FOR SHARE;
  IF NOT FOUND OR NOT pos.published OR NOT pos.voting_open OR pos.election_status = 'closed' THEN
    RAISE EXCEPTION 'Voting is not open for this position' USING ERRCODE = '42501';
  END IF;
  IF pos.voting_end_time IS NOT NULL AND now() >= pos.voting_end_time THEN
    RAISE EXCEPTION 'Voting for this position has ended' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO cand FROM candidates WHERE id = NEW.candidate_id;
  IF NOT FOUND OR NOT cand.approved OR cand.position_id <> NEW.position_id THEN
    RAISE EXCEPTION 'That candidate is not standing for this position' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF NEW.voter_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'You can only cast your own vote' USING ERRCODE = '42501';
    END IF;
    SELECT department_id INTO dept FROM profiles WHERE id = auth.uid();
    IF pos.department_id IS NOT NULL AND dept IS DISTINCT FROM pos.department_id THEN
      RAISE EXCEPTION 'This election is only for students of its department' USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.created_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_vote() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS votes_check ON public.votes;
CREATE TRIGGER votes_check
BEFORE INSERT ON public.votes
FOR EACH ROW EXECUTE FUNCTION public.check_vote();

-- Live tallies for everyone who can see the election
CREATE OR REPLACE FUNCTION public.election_tallies(p_position_id uuid DEFAULT NULL)
RETURNS TABLE (position_id uuid, candidate_id uuid, vote_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.position_id, c.id, count(v.id)
  FROM candidates c
  LEFT JOIN votes v ON v.candidate_id = c.id AND v.position_id = c.position_id
  WHERE c.approved
    AND (p_position_id IS NULL OR c.position_id = p_position_id)
    AND public.can_access_position(c.position_id)
  GROUP BY c.position_id, c.id;
$$;
REVOKE ALL ON FUNCTION public.election_tallies(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.election_tallies(uuid) TO authenticated;

-- Closing (internal: no permission check; called by the two functions below)
CREATE OR REPLACE FUNCTION public._close_election(p_position_id uuid, p_notify boolean DEFAULT true)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pos record;
  total bigint;
  top bigint;
  winners text;
  msg text;
BEGIN
  -- Update lock: waits for votes in flight, then blocks new ones until closed
  SELECT * INTO pos FROM electoral_positions WHERE id = p_position_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Position not found';
  END IF;
  IF pos.election_status = 'closed' THEN
    RETURN json_build_object('position', pos.name, 'already_closed', true);
  END IF;

  UPDATE electoral_positions SET voting_open = false, election_status = 'closed' WHERE id = pos.id;

  DELETE FROM election_results WHERE position_id = pos.id;
  INSERT INTO election_results (position_id, candidate_id, vote_count, is_winner)
  SELECT pos.id, t.candidate_id, t.n, false
  FROM (
    SELECT c.id AS candidate_id, count(v.id)::int AS n
    FROM candidates c
    LEFT JOIN votes v ON v.candidate_id = c.id AND v.position_id = pos.id
    WHERE c.position_id = pos.id AND c.approved
    GROUP BY c.id
  ) t;

  SELECT coalesce(sum(vote_count), 0), coalesce(max(vote_count), 0) INTO total, top
  FROM election_results WHERE position_id = pos.id;

  IF top > 0 THEN
    UPDATE election_results SET is_winner = true WHERE position_id = pos.id AND vote_count = top;
  END IF;

  SELECT string_agg(p.full_name, ' and ' ORDER BY p.full_name) INTO winners
  FROM election_results r
  JOIN candidates c ON c.id = r.candidate_id
  JOIN profiles p ON p.id = c.student_id
  WHERE r.position_id = pos.id AND r.is_winner;

  IF top = 0 THEN
    msg := format('The election for %s has ended with no votes cast.', pos.name);
  ELSIF winners LIKE '% and %' THEN
    msg := format('The election for %s ended in a tie between %s, with %s vote(s) each out of %s.', pos.name, winners, top, total);
  ELSE
    msg := format('%s has won the position of %s with %s vote(s) out of %s total votes.', winners, pos.name, top, total);
  END IF;

  IF p_notify THEN
    -- Eligible voters (the department, or everyone) and admins
    INSERT INTO notifications (user_id, title, message, type, priority, is_read)
    SELECT p.id, format('🏆 Election Result: %s', pos.name), msg, 'election_result', 'urgent', false
    FROM profiles p
    WHERE p.status = 'approved'
      AND (p.role = 'admin'
           OR (p.role = 'student' AND (pos.department_id IS NULL OR p.department_id = pos.department_id)));
  END IF;

  RETURN json_build_object('position', pos.name, 'total', total, 'top_votes', top, 'winners', winners, 'message', msg);
END;
$$;
REVOKE ALL ON FUNCTION public._close_election(uuid, boolean) FROM PUBLIC, anon, authenticated;

-- Manual close by an admin
CREATE OR REPLACE FUNCTION public.close_election(p_position_id uuid, p_notify boolean DEFAULT true)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can close an election' USING ERRCODE = '42501';
  END IF;
  RETURN public._close_election(p_position_id, p_notify);
END;
$$;
REVOKE ALL ON FUNCTION public.close_election(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_election(uuid, boolean) TO authenticated;

-- Close every election whose scheduled end time has passed. Safe for any
-- signed-in page to call: it only closes elections that are already over.
CREATE OR REPLACE FUNCTION public.close_expired_elections()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  out json[] := '{}';
BEGIN
  FOR r IN
    SELECT id FROM electoral_positions
    WHERE voting_open AND election_status <> 'closed'
      AND voting_end_time IS NOT NULL AND voting_end_time <= now()
  LOOP
    out := out || public._close_election(r.id, true);
  END LOOP;
  RETURN to_json(out);
END;
$$;
REVOKE ALL ON FUNCTION public.close_expired_elections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_expired_elections() TO authenticated;

-- Live updates for position changes (open, close, publish)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'electoral_positions'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.electoral_positions;
  END IF;
END $$;

COMMIT;
