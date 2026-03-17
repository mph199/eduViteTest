-- Migration 034: PII anonymization + closed_at column for events

-- Add closed_at to events for reliable retention tracking
ALTER TABLE events ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Backfill: set closed_at for already-closed events
UPDATE events SET closed_at = updated_at WHERE status = 'closed' AND closed_at IS NULL;

-- PII anonymization function for booking_requests
-- Nulls all PII fields for a given event, preserving structural data for statistics.

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
    updated_at = NOW()
  WHERE event_id = p_event_id
    AND (parent_name IS NOT NULL OR email IS NOT NULL);

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Also add a single-row anonymization function for individual requests
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
    updated_at = NOW()
  WHERE id = p_request_id
    AND (parent_name IS NOT NULL OR email IS NOT NULL);

  RETURN FOUND;
END;
$$;
