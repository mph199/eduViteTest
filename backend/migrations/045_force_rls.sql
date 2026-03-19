-- Migration 045: FORCE ROW LEVEL SECURITY auf sensiblen Tabellen
-- Bezug: DB-Audit NEU-M4 (2026-03-19)
--
-- Macht RLS-Policies auch fuer den Table-Owner wirksam.
-- Da die App als Table-Owner (sprechtag) verbindet, werden ohne FORCE
-- alle RLS-Policies umgangen. Mit FORCE gelten die Policies auch fuer
-- den Owner, was die Defense-in-Depth-Strategie vervollstaendigt.

ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE ssw_appointments FORCE ROW LEVEL SECURITY;
ALTER TABLE bl_appointments FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE users IS 'RLS aktiviert + FORCE – Defense-in-Depth (Migration 040/045)';
COMMENT ON TABLE ssw_appointments IS 'RLS aktiviert + FORCE – Defense-in-Depth (Migration 040/045)';
COMMENT ON TABLE bl_appointments IS 'RLS aktiviert + FORCE – Defense-in-Depth (Migration 040/045)';
COMMENT ON TABLE audit_log IS 'RLS aktiviert + FORCE – Defense-in-Depth (Migration 040/045)';
