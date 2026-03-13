-- Migration 022: Schulsozialarbeit module tables
-- Terminbuchung für Beratungsgespräche mit Schulsozialarbeitern

-- Counselors (Berater/innen) — separate from teachers
CREATE TABLE IF NOT EXISTS ssw_counselors (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL DEFAULT '',
  last_name  VARCHAR(255) NOT NULL DEFAULT '',
  name VARCHAR(511) GENERATED ALWAYS AS (TRIM(first_name || ' ' || last_name)) STORED,
  email VARCHAR(255),
  salutation VARCHAR(10),
  room VARCHAR(100),
  phone VARCHAR(50),
  specializations TEXT,           -- comma-separated areas of expertise
  available_from TIME NOT NULL DEFAULT '08:00',
  available_until TIME NOT NULL DEFAULT '14:00',
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointment categories
CREATE TABLE IF NOT EXISTS ssw_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(10) DEFAULT '💬',
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Seed default categories
INSERT INTO ssw_categories (name, description, icon, sort_order) VALUES
  ('Persönliche Probleme', 'Unterstützung bei persönlichen oder familiären Schwierigkeiten', '🤝', 1),
  ('Konflikte', 'Hilfe bei Konflikten mit Mitschüler/innen oder Lehrkräften', '⚖️', 2),
  ('Schulische Probleme', 'Beratung bei Leistungsproblemen, Prüfungsangst, Motivation', '📚', 3),
  ('Berufsorientierung', 'Unterstützung bei der beruflichen Orientierung und Bewerbungen', '🎯', 4),
  ('Sonstiges', 'Allgemeine Beratung oder anderes Anliegen', '💬', 5)
ON CONFLICT DO NOTHING;

-- Appointments (Beratungstermine)
CREATE TABLE IF NOT EXISTS ssw_appointments (
  id SERIAL PRIMARY KEY,
  counselor_id INTEGER NOT NULL REFERENCES ssw_counselors(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES ssw_categories(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'requested', 'confirmed', 'cancelled', 'completed')),
  -- Booking info (filled when booked)
  student_name VARCHAR(255),
  student_class VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  concern TEXT,                   -- short description of the concern (confidential)
  is_urgent BOOLEAN DEFAULT FALSE,
  notes TEXT,                     -- internal notes by counselor (not visible to student)
  booked_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_ssw_appointments_counselor_date ON ssw_appointments(counselor_id, date);
CREATE INDEX IF NOT EXISTS idx_ssw_appointments_status ON ssw_appointments(status);
