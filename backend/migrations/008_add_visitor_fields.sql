-- Migration: Add visitor type and new booking fields to slots table

-- Add new columns
ALTER TABLE slots 
ADD COLUMN IF NOT EXISTS visitor_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS trainee_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS message TEXT;

-- Add check constraint for visitor_type
ALTER TABLE slots 
ADD CONSTRAINT check_visitor_type 
CHECK (visitor_type IS NULL OR visitor_type IN ('parent', 'company'));

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_slots_email ON slots(email);

COMMENT ON COLUMN slots.visitor_type IS 'Type of visitor: parent or company';
COMMENT ON COLUMN slots.company_name IS 'Name of the training company (for visitor_type=company)';
COMMENT ON COLUMN slots.trainee_name IS 'Name of the trainee (for visitor_type=company)';
COMMENT ON COLUMN slots.email IS 'Email address of the visitor';
COMMENT ON COLUMN slots.message IS 'Optional message to the teacher';
