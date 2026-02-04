-- Migration: Add events table and link slots to events

-- Events table tracks each Elternsprechtag (2 per school year, but flexible)
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  school_year VARCHAR(20) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Berlin',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  booking_opens_at TIMESTAMPTZ,
  booking_closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT events_status_check CHECK (status IN ('draft', 'published', 'closed')),
  CONSTRAINT events_time_check CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_school_year ON events(school_year);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);

-- Link slots to an event
ALTER TABLE slots
ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_slots_event_id ON slots(event_id);

-- Enable RLS (recommended). Without policies, the table is not directly accessible.
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;

-- Optional: If you later want events to be readable directly from Supabase clients,
-- create a SELECT policy in Supabase. This project currently serves events via the backend.
