-- Migration 029: Beratungslehrer-Geister bereinigen
-- Entfernt verwaiste Eintraege aus bl_counselors, user_module_access und users

BEGIN;

-- 1) Geist-Typ 1: bl_counselors ohne verknuepften User (user_id IS NULL)
--    Entsteht wenn ein User geloescht wurde (ON DELETE SET NULL)
--    CASCADE loescht automatisch: bl_appointments, bl_weekly_schedule, bl_requests
DELETE FROM bl_counselors WHERE user_id IS NULL;

-- 2) Geist-Typ 2: user_module_access 'beratungslehrer' ohne bl_counselors-Profil
--    Entsteht wenn bl_counselors-Eintrag geloescht wurde, aber module_access blieb
DELETE FROM user_module_access
WHERE module_key = 'beratungslehrer'
  AND user_id NOT IN (SELECT user_id FROM bl_counselors WHERE user_id IS NOT NULL);

-- 3) Geist-Typ 3: Users mit role='beratungslehrer' (veraltet seit Migration 028)
--    Diese sollten role='teacher' haben und ueber user_module_access gesteuert werden
UPDATE users SET role = 'teacher'
WHERE role = 'beratungslehrer';

COMMIT;
