-- Migration: Add anonymous feedback table
-- Stores feedback & wishes from teacher environment, displayed anonymized in admin dashboard.

CREATE TABLE IF NOT EXISTS feedback (
  id BIGSERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- Enable RLS (recommended). Without policies, the table is not directly accessible.
-- This project reads/writes feedback via the backend.
ALTER TABLE IF EXISTS public.feedback ENABLE ROW LEVEL SECURITY;
