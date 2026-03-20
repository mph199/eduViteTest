# VPS-Launch Checkliste

Konsolidierte Ergebnisse aus Security-Audit (Waechter), DB-Audit (DB-Analyst) und Production-Config-Audit.

Stand: 2026-03-19

---

## KRITISCH – Vor Go-Live beheben

| # | Befund | Quelle | Datei | Status |
|---|--------|--------|-------|--------|
| K1 | ~~Backend-Port 4000 oeffentlich~~ | Security | `docker-compose.yml:46` | **ERLEDIGT** (2026-03-19) – `"127.0.0.1:4000:4000"` |
| K2 | ~~Default-Admin `Start/Start` ohne `force_password_change`~~ | Security | Migration 048 + `ProtectedRoute.tsx` | **ERLEDIGT** (2026-03-19) – Migration 048 setzt `force_password_change=TRUE` fuer Default-Admin; Admin-Ausnahme in ProtectedRoute entfernt |
| K3 | ~~Connection-Pool nicht konfiguriert~~ | DB | `backend/config/db.js` | **ERLEDIGT** (2026-03-19) – `max=20`, `connectionTimeoutMillis=5000`, `idleTimeoutMillis=30000` via `DB_POOL_MAX`, `DB_POOL_CONNECT_TIMEOUT`, `DB_POOL_IDLE_TIMEOUT` |
|---|--------|--------|-------|--------|
| K1 | ~~Backend-Port 4000 oeffentlich~~ | Security | `docker-compose.yml:46` | **ERLEDIGT** (2026-03-19) – `"127.0.0.1:4000:4000"` |
| K2 | ~~Default-Admin `Start/Start` ohne `force_password_change`~~ | Security | Migration 048 + `ProtectedRoute.tsx` | **ERLEDIGT** (2026-03-19) – Migration 048 setzt `force_password_change=TRUE` fuer Default-Admin; Admin-Ausnahme in ProtectedRoute entfernt |
| K3 | ~~Connection-Pool nicht konfiguriert~~ | DB | `backend/config/db.js` | **ERLEDIGT** (2026-03-19) – `max=20`, `connectionTimeoutMillis=5000`, `idleTimeoutMillis=30000` via `DB_POOL_MAX`, `DB_POOL_CONNECT_TIMEOUT`, `DB_POOL_IDLE_TIMEOUT` |
>>>>>>> origin/claude/review-project-overview-YgD1t
| K4 | HTTPS/TLS nicht in nginx.conf – externer Reverse Proxy MUSS konfiguriert werden | Config | `nginx.conf` | Caddy als Reverse Proxy (wie in install.md dokumentiert) ODER Security-Headers direkt in nginx.conf |

---

## HOCH – Sollte vor Go-Live behoben werden

| # | Befund | Quelle | Datei | Fix |
|---|--------|--------|-------|-----|
| H1 | Default-Credentials in `.env.example` (`sprechtag/sprechtag`) | Security | `backend/.env.example:44-46` | Placeholders `<CHANGE-ME>` statt echte Werte |
| H2 | nginx ohne Security-Headers – kein X-Frame-Options, HSTS, nosniff | Security | `nginx.conf` | `add_header`-Direktiven einfuegen |
| H3 | Keine Docker-Netzwerk-Isolation – Frontend kann direkt auf Postgres zugreifen | Security | `docker-compose.yml` | Explizite `networks:` (frontend_net, backend_net) |
| H4 | consent_receipts ohne Loeschkonzept – DSGVO Art. 17 Konflikt | DB/DSGVO | `backend/jobs/retention-cleanup.js` | Retention-Job fuer consent_receipts ergaenzen (z.B. IP/UA nach 5 Jahren anonymisieren) |
| H5 | Backup-Dumps unverschluesselt – PII im Klartext | DB | `scripts/backup.sh` | `gpg --symmetric` oder `openssl enc` vor Speicherung |
| H6 | Kein Off-Site-Backup – Backups nur lokal | DB | `scripts/backup.sh` | rsync/rclone zu externem Storage, `backups/` in `.dockerignore` |
| H7 | Keine Restore-Dokumentation | DB | `docs/deployment/install.md` | Restore-Prozedur dokumentieren |
| H8 | Health-Endpunkt leakt Statistiken (teacherCount, slotCount) | Security | `backend/modules/elternsprechtag/routes/public.js:499-517` | Auf `{"status":"ok"}` reduzieren, Statistiken hinter Auth |

---

## MITTEL – Baldmoeglichst nach Launch

| # | Befund | Quelle | Fix |
|---|--------|--------|-----|
| M1 | In-Memory Admin-Lockout – Container-Restart setzt Zaehler zurueck | Security | DB-basierter Lockout oder strengeres Rate-Limit |
| M2 | X-Request-Id Log Injection – beliebige Strings werden in Logs geschrieben | Security | UUID-Format validieren (`/^[0-9a-f-]{36}$/i`) |
| M3 | ssw_counselors + bl_counselors ohne RLS – PII-Tabellen offen | DB | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY; ALTER TABLE ... FORCE ROW LEVEL SECURITY;` |
| M4 | restricted-Flag bei ssw/bl Retention-Cleanup nicht gesetzt | DB/DSGVO | `restricted = TRUE` in UPDATE-Statements in `retention-cleanup.js` ergaenzen |
| M5 | IP-Adressen als Klartext in audit_log + consent_receipts | DB/DSGVO | Letztes Oktet maskieren oder hashen |
| M6 | Fehlende Indizes auf `date` fuer ssw_appointments + bl_appointments | DB | `CREATE INDEX IF NOT EXISTS idx_ssw_appointments_date ON ssw_appointments(date);` (analog bl) |
| M7 | DB-SSL deaktiviert – bei externem Managed-Postgres kritisch | Security | `DB_SSL=true` in docker-compose.yml |

---

## NIEDRIG – Nice to have

| # | Befund |
|---|--------|
| N1 | JWT_SECRET und SESSION_SECRET teilen sich denselben Wert |
| N2 | Dockerfile.backend startet als root (su-exec funktioniert, aber Entrypoint-Fehler = root) |
| N3 | Kein LIMIT auf oeffentlichen Listen-Queries (teachers, events) |
| N4 | consent_receipts.user_agent ungekuerzt (Browser-Fingerprint) |
| N5 | slots-Tabelle hat kein restricted-Flag |
| N6 | Kein automatischer Loeschzeitpunkt fuer Beschaeftigtendaten (teachers, counselors) |

---

## Bereits gut implementiert

- Graceful Shutdown (SIGTERM/SIGINT + 10s Timeout)
- Structured Logging (Pino JSON in Production)
- Helmet + CSP konfiguriert
- Upload-CSP (script-src 'none')
- DSGVO Retention-Cleanup (slots, booking_requests, ssw/bl_appointments)
- Backup-Script mit Retention (30 Tage)
- CI/CD (GitHub Actions: Docker Build + Security Audit)
- Health-Check in Dockerfile + docker-compose
- Cookie-basierte JWT Auth (httpOnly, Secure, SameSite)
- Alle DB-Queries parametrisiert
- Keine hardcoded localhost-URLs in Production-Pfaden
- 0 npm audit Vulnerabilities (Frontend + Backend)
- Migrations-Tracking (applied_migrations, korrekte Reihenfolge)
