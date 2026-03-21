-- Ensure 'Start' is the only superadmin in the DB.
-- All other superadmins are demoted to admin.
UPDATE users SET role = 'superadmin' WHERE username = 'Start';
UPDATE users SET role = 'admin' WHERE role = 'superadmin' AND username != 'Start';
