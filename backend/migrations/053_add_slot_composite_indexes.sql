-- Composite index for the most common slot query pattern (teacher + date)
-- Covers slotAssignment.js, autoAssign.js, and eventsRoutes.js queries
CREATE INDEX IF NOT EXISTS idx_slots_teacher_date ON slots(teacher_id, date);

-- Index for counselor user_id lookups (login, profile)
CREATE INDEX IF NOT EXISTS idx_ssw_counselors_user_id ON ssw_counselors(user_id);
CREATE INDEX IF NOT EXISTS idx_bl_counselors_user_id ON bl_counselors(user_id);
