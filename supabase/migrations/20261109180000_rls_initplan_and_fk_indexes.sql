-- Performance under load (Supabase advisor: auth_rls_initplan, unindexed_foreign_keys)
--
-- 1. Access rules called auth.uid(), is_admin() and is_teacher() once per row.
--    is_admin()/is_teacher() each read profiles, so a page listing a few
--    hundred rows ran hundreds of extra lookups. Wrapping each call in
--    (SELECT ...) makes Postgres evaluate it once per query. Who can see what
--    does not change. Safe to run again: already-wrapped calls are kept.
-- 2. Index every foreign key that has no index, so joins, cascading deletes
--    and per-user lookups stay fast as tables grow.

DO $$
DECLARE
  p record;
  q text;
  w text;
  stmt text;
BEGIN
  FOR p IN SELECT tablename, policyname, qual, with_check FROM pg_policies WHERE schemaname = 'public' LOOP
    q := p.qual;
    w := p.with_check;
    IF q IS NOT NULL THEN
      q := regexp_replace(q, '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\)', '@@UID@@', 'gi');
      q := regexp_replace(q, '\(\s*SELECT\s+is_admin\(\)\s+AS\s+is_admin\)', '@@ADM@@', 'gi');
      q := regexp_replace(q, '\(\s*SELECT\s+is_teacher\(\)\s+AS\s+is_teacher\)', '@@TEA@@', 'gi');
      q := replace(replace(replace(q, 'auth.uid()', '(SELECT auth.uid())'), 'is_admin()', '(SELECT is_admin())'), 'is_teacher()', '(SELECT is_teacher())');
      q := replace(replace(replace(q, '@@UID@@', '(SELECT auth.uid())'), '@@ADM@@', '(SELECT is_admin())'), '@@TEA@@', '(SELECT is_teacher())');
    END IF;
    IF w IS NOT NULL THEN
      w := regexp_replace(w, '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\)', '@@UID@@', 'gi');
      w := regexp_replace(w, '\(\s*SELECT\s+is_admin\(\)\s+AS\s+is_admin\)', '@@ADM@@', 'gi');
      w := regexp_replace(w, '\(\s*SELECT\s+is_teacher\(\)\s+AS\s+is_teacher\)', '@@TEA@@', 'gi');
      w := replace(replace(replace(w, 'auth.uid()', '(SELECT auth.uid())'), 'is_admin()', '(SELECT is_admin())'), 'is_teacher()', '(SELECT is_teacher())');
      w := replace(replace(replace(w, '@@UID@@', '(SELECT auth.uid())'), '@@ADM@@', '(SELECT is_admin())'), '@@TEA@@', '(SELECT is_teacher())');
    END IF;
    IF q IS DISTINCT FROM p.qual OR w IS DISTINCT FROM p.with_check THEN
      stmt := format('ALTER POLICY %I ON public.%I', p.policyname, p.tablename);
      IF q IS NOT NULL THEN stmt := stmt || format(' USING (%s)', q); END IF;
      IF w IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)', w); END IF;
      EXECUTE stmt;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT c.conrelid::regclass AS tbl, cl.relname AS tname, a.attname AS col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND n.nspname = 'public' AND array_length(c.conkey, 1) = 1
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]
      )
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%I)', left(fk.tname || '_' || fk.col || '_fk_idx', 63), fk.tbl, fk.col);
  END LOOP;
END $$;
