-- Stop and flag duplicate accounts (one person registering several times to vote)
--
-- 1. Matric numbers are stored in one standard form (upper case, no spaces) and
--    each matric number can belong to only one account.
-- 2. matric_available(): lets the sign up form say "already registered" before
--    creating anything. Returns only true/false.
-- 3. account_signals: each verification and sign in records the browser's
--    device id, network address and browser name. Only the server can write it
--    (record_account_signal) and only admins can read the summary
--    (admin_account_signals), which lists accounts sharing a device or network.

BEGIN;

-- 1. Matric numbers
CREATE OR REPLACE FUNCTION public.normalize_student_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.student_id IS NOT NULL THEN
    NEW.student_id := NULLIF(upper(regexp_replace(NEW.student_id, '\s', '', 'g')), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_normalize_student_id ON public.profiles;
CREATE TRIGGER profiles_normalize_student_id
BEFORE INSERT OR UPDATE OF student_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.normalize_student_id();

UPDATE public.profiles
SET student_id = NULLIF(upper(regexp_replace(student_id, '\s', '', 'g')), '')
WHERE student_id IS NOT NULL AND student_id <> upper(regexp_replace(student_id, '\s', '', 'g'));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_student_id_unique
ON public.profiles (student_id) WHERE student_id IS NOT NULL;

-- 2. Pre-check for the sign up form
CREATE OR REPLACE FUNCTION public.matric_available(p_student_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE student_id = NULLIF(upper(regexp_replace(coalesce(p_student_id, ''), '\s', '', 'g')), '')
  );
$$;
REVOKE ALL ON FUNCTION public.matric_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.matric_available(text) TO anon, authenticated;

-- 3. Device and network signals
CREATE TABLE IF NOT EXISTS public.account_signals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  device_id text,
  ip text,
  user_agent text,
  event text NOT NULL DEFAULT 'sign_in',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_signals_user_idx ON public.account_signals (user_id);
CREATE INDEX IF NOT EXISTS account_signals_device_idx ON public.account_signals (device_id);
CREATE INDEX IF NOT EXISTS account_signals_ip_idx ON public.account_signals (ip);
ALTER TABLE public.account_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_signals FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_account_signal(p_device_id text, p_event text DEFAULT 'sign_in')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h json;
  v_ip text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  h := nullif(current_setting('request.headers', true), '')::json;
  v_ip := coalesce(h->>'cf-connecting-ip', split_part(h->>'x-forwarded-for', ',', 1), h->>'x-real-ip');
  -- One row per device/network per day is enough
  IF EXISTS (
    SELECT 1 FROM account_signals
    WHERE user_id = auth.uid() AND device_id IS NOT DISTINCT FROM left(p_device_id, 64)
      AND ip IS NOT DISTINCT FROM nullif(trim(v_ip), '') AND created_at > now() - interval '1 day'
  ) THEN RETURN; END IF;
  INSERT INTO account_signals (user_id, device_id, ip, user_agent, event)
  VALUES (auth.uid(), left(p_device_id, 64), nullif(trim(v_ip), ''), left(h->>'user-agent', 300),
          CASE WHEN p_event IN ('sign_up', 'sign_in') THEN p_event ELSE 'sign_in' END);
END;
$$;
REVOKE ALL ON FUNCTION public.record_account_signal(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_account_signal(text, text) TO authenticated;

-- For each account: other accounts seen on the same device or the same network
CREATE OR REPLACE FUNCTION public.admin_account_signals()
RETURNS TABLE (user_id uuid, same_device jsonb, same_network jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  WITH s AS (SELECT DISTINCT a.user_id, a.device_id, a.ip FROM account_signals a),
  dev AS (
    SELECT s1.user_id, jsonb_agg(DISTINCT jsonb_build_object('id', p.id, 'name', p.full_name, 'status', p.status)) AS others
    FROM s s1 JOIN s s2 ON s2.device_id = s1.device_id AND s2.user_id <> s1.user_id AND s1.device_id IS NOT NULL
    JOIN profiles p ON p.id = s2.user_id
    GROUP BY s1.user_id
  ),
  net AS (
    SELECT s1.user_id, jsonb_agg(DISTINCT jsonb_build_object('id', p.id, 'name', p.full_name, 'status', p.status)) AS others
    FROM s s1 JOIN s s2 ON s2.ip = s1.ip AND s2.user_id <> s1.user_id AND s1.ip IS NOT NULL
    JOIN profiles p ON p.id = s2.user_id
    GROUP BY s1.user_id
  )
  SELECT coalesce(dev.user_id, net.user_id), coalesce(dev.others, '[]'::jsonb), coalesce(net.others, '[]'::jsonb)
  FROM dev FULL JOIN net ON net.user_id = dev.user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_account_signals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_account_signals() TO authenticated;

COMMIT;
