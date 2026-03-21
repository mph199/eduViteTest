-- Restore superadmin role for marc.huhn
UPDATE users SET role = 'superadmin' WHERE username = 'marc.huhn' AND role != 'superadmin';
