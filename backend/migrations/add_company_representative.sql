-- Migration: Add representative_name to slots for company bookings
ALTER TABLE slots
ADD COLUMN IF NOT EXISTS representative_name VARCHAR(255);

COMMENT ON COLUMN slots.representative_name IS 'Representative of the training company (for visitor_type=company)';
