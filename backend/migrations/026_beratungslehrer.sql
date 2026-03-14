-- Migration 026: Beratungslehrer-Modul
-- Sprechstunden, Themenkategorien, anonyme Anfragen

-- 1) Rolle 'beratungslehrer' zum User-Constraint hinzufuegen
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'teacher', 'superadmin', 'ssw', 'beratungslehrer'));

-- 2) Beratungslehrer (analog ssw_counselors)
CREATE TABLE IF NOT EXISTS bl_counselors (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL DEFAULT '',
  last_name  VARCHAR(255) NOT NULL DEFAULT '',
  name VARCHAR(511) GENERATED ALWAYS AS (TRIM(first_name || ' ' || last_name)) STORED,
  email VARCHAR(255),
  salutation VARCHAR(10),
  room VARCHAR(100),
  phone VARCHAR(50),
  specializations TEXT,
  available_from TIME NOT NULL DEFAULT '08:00',
  available_until TIME NOT NULL DEFAULT '14:00',
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) Themenkategorien
CREATE TABLE IF NOT EXISTS bl_topics (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Seed-Daten fuer Themen
INSERT INTO bl_topics (name, description, sort_order)
SELECT * FROM (VALUES
  ('Lernprobleme', 'Hilfe bei Lernschwierigkeiten, Motivation, Pruefungsangst', 1),
  ('Persoenliche Anliegen', 'Vertrauliche Beratung bei persoenlichen Themen', 2),
  ('Konflikte', 'Vermittlung bei Konflikten mit Mitschuelern oder Lehrkraeften', 3),
  ('Schullaufbahn', 'Beratung zu Schulwechsel, Abschluessen, Perspektiven', 4),
  ('Sonstiges', 'Allgemeine Beratung', 5)
) AS t(name, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM bl_topics LIMIT 1);

-- 4) Sprechstunden-Termine (analog ssw_appointments, mit is_anonymous)
CREATE TABLE IF NOT EXISTS bl_appointments (
  id SERIAL PRIMARY KEY,
  counselor_id INTEGER NOT NULL REFERENCES bl_counselors(id) ON DELETE CASCADE,
  topic_id INTEGER REFERENCES bl_topics(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'requested', 'confirmed', 'cancelled', 'completed')),
  student_name VARCHAR(255),
  student_class VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  concern TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  is_urgent BOOLEAN DEFAULT FALSE,
  notes TEXT,
  booked_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bl_appointments_counselor_date ON bl_appointments(counselor_id, date);
CREATE INDEX IF NOT EXISTS idx_bl_appointments_status ON bl_appointments(status);

-- 5) Anonyme Anfragen
CREATE TABLE IF NOT EXISTS bl_requests (
  id SERIAL PRIMARY KEY,
  counselor_id INTEGER REFERENCES bl_counselors(id) ON DELETE CASCADE,
  topic_id INTEGER REFERENCES bl_topics(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  contact_method VARCHAR(50) DEFAULT 'none'
    CHECK (contact_method IN ('none', 'email', 'note')),
  contact_info VARCHAR(255),
  is_urgent BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'read', 'in_progress', 'answered', 'closed')),
  response TEXT,
  responded_at TIMESTAMPTZ,
  responded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  access_token VARCHAR(64) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bl_requests_counselor ON bl_requests(counselor_id);
CREATE INDEX IF NOT EXISTS idx_bl_requests_status ON bl_requests(status);
CREATE INDEX IF NOT EXISTS idx_bl_requests_token ON bl_requests(access_token);

-- 6) Wochenplan (analog ssw_weekly_schedule)
CREATE TABLE IF NOT EXISTS bl_weekly_schedule (
  id SERIAL PRIMARY KEY,
  counselor_id INTEGER NOT NULL REFERENCES bl_counselors(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time TIME NOT NULL DEFAULT '14:00',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(counselor_id, weekday)
);
