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

-- RLS (Row Level Security) Policies
-- Für Public-Zugriff (Buchungssystem)
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;

-- Jeder kann Lehrer lesen
DROP POLICY IF EXISTS "Teachers are viewable by everyone" ON teachers;
CREATE POLICY "Teachers are viewable by everyone" 
  ON teachers FOR SELECT 
  USING (true);

-- Jeder kann Slots lesen
DROP POLICY IF EXISTS "Slots are viewable by everyone" ON slots;
CREATE POLICY "Slots are viewable by everyone" 
  ON slots FOR SELECT 
  USING (true);

-- Jeder kann Buchungen erstellen (Slots updaten)
DROP POLICY IF EXISTS "Anyone can book slots" ON slots;
CREATE POLICY "Anyone can book slots" 
  ON slots FOR UPDATE 
  USING (true);

-- Nur für spätere Admin-Funktionen (optional)
DROP POLICY IF EXISTS "Anyone can insert slots" ON slots;
CREATE POLICY "Anyone can insert slots" 
  ON slots FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete slots" ON slots;
CREATE POLICY "Anyone can delete slots" 
  ON slots FOR DELETE 
  USING (true);
