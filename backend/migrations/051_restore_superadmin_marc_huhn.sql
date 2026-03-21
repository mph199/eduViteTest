-- Demote all DB superadmins to admin.
-- Superadmin is reserved for the env-based system account (Start).
UPDATE users SET role = 'admin' WHERE role = 'superadmin';
