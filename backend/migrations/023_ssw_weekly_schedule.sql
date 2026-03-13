-- Migration 023: SSW weekly schedule
-- Replace simple available_from/until with per-weekday schedule

CREATE TABLE IF NOT EXISTS ssw_weekly_schedule (
  id SERIAL PRIMARY KEY,
  counselor_id INTEGER NOT NULL REFERENCES ssw_counselors(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0=Montag, 1=Dienstag, ..., 4=Freitag, 5=Samstag, 6=Sonntag
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time TIME NOT NULL DEFAULT '14:00',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (counselor_id, weekday)
);

CREATE INDEX IF NOT EXISTS idx_ssw_weekly_schedule_counselor ON ssw_weekly_schedule(counselor_id);
