-- Supabase Schema für BKSB Elternsprechtag

-- Teachers Tabelle
CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Slots Tabelle
CREATE TABLE IF NOT EXISTS slots (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  time VARCHAR(50) NOT NULL,
  date VARCHAR(50) NOT NULL,
  booked BOOLEAN DEFAULT FALSE,
  parent_name VARCHAR(255),
  student_name VARCHAR(255),
  class_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index für schnellere Abfragen
CREATE INDEX IF NOT EXISTS idx_slots_teacher_id ON slots(teacher_id);
CREATE INDEX IF NOT EXISTS idx_slots_booked ON slots(booked);

-- Initial Teachers Daten
INSERT INTO teachers (name, subject) VALUES
  ('Frau Müller', 'Mathematik'),
  ('Herr Schmidt', 'Deutsch'),
  ('Frau Weber', 'Englisch'),
  ('Herr Fischer', 'Biologie'),
  ('Frau Huhn', 'Dermatologie')
ON CONFLICT DO NOTHING;

-- Initial Slots Daten (beispielhaft für die ersten 2 Lehrer)
INSERT INTO slots (teacher_id, time, date, booked) VALUES
  (1, '14:00 - 14:15', '24.11.2025', false),
  (1, '14:15 - 14:30', '24.11.2025', false),
  (1, '14:30 - 14:45', '24.11.2025', false),
  (1, '14:45 - 15:00', '24.11.2025', false),
  (2, '15:00 - 15:15', '24.11.2025', false),
  (2, '15:15 - 15:30', '24.11.2025', false),
  (2, '15:30 - 15:45', '24.11.2025', false),
  (3, '14:00 - 14:15', '24.11.2025', false),
  (3, '14:15 - 14:30', '24.11.2025', false),
  (3, '14:30 - 14:45', '24.11.2025', false),
  (4, '15:00 - 15:15', '24.11.2025', false),
  (4, '15:15 - 15:30', '24.11.2025', false),
  (5, '14:00 - 14:15', '24.11.2025', false),
  (5, '14:15 - 14:30', '24.11.2025', false)
ON CONFLICT DO NOTHING;

-- RLS (Row Level Security) Policies
-- Für Public-Zugriff (Buchungssystem)
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;

-- Jeder kann Lehrer lesen
CREATE POLICY "Teachers are viewable by everyone" 
  ON teachers FOR SELECT 
  USING (true);

-- Jeder kann Slots lesen
CREATE POLICY "Slots are viewable by everyone" 
  ON slots FOR SELECT 
  USING (true);

-- Jeder kann Buchungen erstellen (Slots updaten)
CREATE POLICY "Anyone can book slots" 
  ON slots FOR UPDATE 
  USING (true);

-- Nur für spätere Admin-Funktionen (optional)
CREATE POLICY "Anyone can insert slots" 
  ON slots FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can delete slots" 
  ON slots FOR DELETE 
  USING (true);
