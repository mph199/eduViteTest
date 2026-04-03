-- Add icon column to choice_groups and choice_options
ALTER TABLE choice_groups ADD COLUMN IF NOT EXISTS icon VARCHAR(100);
ALTER TABLE choice_options ADD COLUMN IF NOT EXISTS icon VARCHAR(100);
