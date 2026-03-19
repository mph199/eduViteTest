-- Migration 047: DB-Audit Befunde NEU-1 bis NEU-5 (2026-03-19)
--
-- NEU-1 (MITTEL): restricted-Flag bei Anonymisierung setzen
-- NEU-2 (NIEDRIG): Neue DB-Funktion fuer email-basierte Anonymisierung
-- NEU-3 (NIEDRIG): Fehlende Email-Indizes auf ssw/bl_appointments
-- NEU-5 (NIEDRIG): booking_requests + events: FORCE RLS + permissive Policy

-- ============================================================
-- NEU-1 + NEU-2: DB-Funktionen mit restricted-Flag aktualisieren
-- ============================================================

-- Einzelne booking_request anonymisieren (by ID)
CREATE OR REPLACE FUNCTION anonymize_booking_request(p_request_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE booking_requests
  SET
    parent_name = NULL,
    company_name = NULL,
    student_name = NULL,
    trainee_name = NULL,
    representative_name = NULL,
    class_name = NULL,
    email = NULL,
    message = NULL,
    verification_token_hash = NULL,
    restricted = TRUE,
    updated_at = NOW()
  WHERE id = p_request_id
    AND (parent_name IS NOT NULL OR email IS NOT NULL);

  RETURN FOUND;
END;
$$;

-- Alle booking_requests eines Events anonymisieren (by event_id)
CREATE OR REPLACE FUNCTION anonymize_booking_requests(p_event_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE booking_requests
  SET
    parent_name = NULL,
    company_name = NULL,
    student_name = NULL,
    trainee_name = NULL,
    representative_name = NULL,
    class_name = NULL,
    email = NULL,
    message = NULL,
    verification_token_hash = NULL,
    restricted = TRUE,
    updated_at = NOW()
  WHERE event_id = p_event_id
    AND (parent_name IS NOT NULL OR email IS NOT NULL);

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- NEU-2: Neue Funktion fuer email-basierte Anonymisierung (consent/withdraw)
-- Erwartet lowercase-Email (wird intern nochmals normalisiert als Doppelschutz)
CREATE OR REPLACE FUNCTION anonymize_booking_requests_by_email(p_email TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  affected INTEGER;
  normalized_email TEXT;
BEGIN
  IF p_email IS NULL THEN RETURN 0; END IF;
  normalized_email := LOWER(p_email);

  UPDATE booking_requests
  SET
    parent_name = NULL,
    company_name = NULL,
    student_name = NULL,
    trainee_name = NULL,
    representative_name = NULL,
    class_name = NULL,
    email = NULL,
    message = NULL,
    verification_token_hash = NULL,
    restricted = TRUE,
    updated_at = NOW()
  WHERE LOWER(email) = normalized_email;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- ============================================================
-- NEU-3: Fehlende Email-Indizes fuer consent/withdraw Queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ssw_appointments_email ON ssw_appointments (email);
CREATE INDEX IF NOT EXISTS idx_bl_appointments_email ON bl_appointments (email);

-- ============================================================
-- NEU-5: booking_requests + events – FORCE RLS + permissive Policy
-- ============================================================
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_requests FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY app_full_access_booking_requests ON booking_requests
    FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
COMMENT ON TABLE booking_requests IS 'RLS FORCE + permissive Policy (Migration 047)';

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY app_full_access_events ON events
    FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
COMMENT ON TABLE events IS 'RLS FORCE + permissive Policy (Migration 047)';
