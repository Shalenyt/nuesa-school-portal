
-- Trigger to enforce single active semester
CREATE OR REPLACE FUNCTION public.enforce_single_active_semester()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE semester_config SET is_active = false WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_single_semester_update
BEFORE UPDATE OF is_active ON semester_config
FOR EACH ROW
WHEN (NEW.is_active = true)
EXECUTE FUNCTION enforce_single_active_semester();

CREATE TRIGGER enforce_single_semester_insert
BEFORE INSERT ON semester_config
FOR EACH ROW
WHEN (NEW.is_active = true)
EXECUTE FUNCTION enforce_single_active_semester();

-- Function to auto-manage semester lifecycle based on dates
CREATE OR REPLACE FUNCTION public.auto_manage_semester_lifecycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Deactivate ended semesters
  UPDATE semester_config SET is_active = false, updated_at = now()
  WHERE end_date < CURRENT_DATE AND is_active = true;
  
  -- Auto-activate current semester if none active
  IF NOT EXISTS (SELECT 1 FROM semester_config WHERE is_active = true) THEN
    UPDATE semester_config SET is_active = true, updated_at = now()
    WHERE id = (
      SELECT id FROM semester_config
      WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
      ORDER BY start_date DESC
      LIMIT 1
    );
  END IF;
END;
$$;
