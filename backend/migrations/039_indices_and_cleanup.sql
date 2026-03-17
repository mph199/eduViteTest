-- Migration 039: Fehlende Indizes + Klartext verification_token entfernen
-- Bezug: DB-Audit H1-H6, dsgvo-saas-todo 1.2.4 + 1.2.6

-- 1. Fehlende Indizes
CREATE INDEX IF NOT EXISTS idx_booking_requests_email
    ON booking_requests(email);

CREATE INDEX IF NOT EXISTS idx_booking_requests_verification_token_hash
    ON booking_requests(verification_token_hash);

CREATE INDEX IF NOT EXISTS idx_users_teacher_id
    ON users(teacher_id);

CREATE INDEX IF NOT EXISTS idx_bl_weekly_schedule_counselor_id
    ON bl_weekly_schedule(counselor_id);

-- 2. Klartext verification_token entfernen (Sicherheitsrisiko)
-- Alle existierenden Tokens wurden bereits in verification_token_hash migriert (Migration 011)
ALTER TABLE slots DROP COLUMN IF EXISTS verification_token;

-- Index auf altem Klartext-Token entfernen (falls vorhanden)
DROP INDEX IF EXISTS idx_slots_verification_token;
