# SSW-Berater in Benutzerverwaltung: Dokumentation

## Übersicht

SSW-Berater können jetzt über die zentrale Benutzerverwaltung ("Benutzer & Rechte") erstellt werden — analog zur bestehenden BL-Berater-Sektion. Zusätzlich: Rollenkonflikt-Fix, Sidebar-Trennung, Adminrechte-Tab.

## Änderungen

### Backend

| Datei | Änderung |
|-------|---------|
| `helpers.js` | `upsertSswCounselor()` (analog BL) + token_version bei module_access-Änderung |
| `crud.js` | POST/PUT/DELETE um SSW-Profil erweitert, `GET /teachers/:id/ssw` neu |
| `userRoutes.js` | Pfad-Fix: `/:id/admin-access` → `/users/:id/admin-access` |

### Frontend

| Datei | Änderung |
|-------|---------|
| `TeacherForm.tsx` | Reiterleiste statt Aufklappfelder: Stammdaten / BL / SSW / Adminrechte |
| `index.tsx` | sswForm State, handleEdit lädt SSW-Daten, handleSubmit speichert adminModules |
| `AuthContext.tsx` | canTeacher nur mit teacherId (nicht role=teacher) |
| `GlobalTopHeader.tsx` | Sidebar: view-Attribut von Items bestimmt Gruppen-view |
| `registry.ts` | SidebarNavItem um `view: 'admin' | 'teacher'` erweitert |
| `schulsozialarbeit/index.ts` | Sidebar-Item: `view: 'admin'`, `allowedModules` |
| `beratungslehrer/index.ts` | Sidebar-Item: `view: 'admin'`, `allowedModules` |

### Types

| Typ | Änderung |
|-----|---------|
| `SswFormData` | Neu: room, phone, specializations, slot_duration, requires_confirmation, schedule |
| `Teacher` | `bl_counselor_id` + `ssw_counselor_id` ergänzt |

## Security-Review (Wächter)

| # | Schweregrad | Befund | Status |
|---|-------------|--------|--------|
| 1 | Hoch | token_version nicht inkrementiert bei upsert module_access | Behoben (BL + SSW) |
| 2 | Mittel | PUT /teachers SSW-Upsert Fehler wird verschluckt | Akzeptiert (bestehendes Pattern) |
| 3 | Mittel | Admin kann SSW-Profile anlegen (Design-Entscheidung) | Dokumentiert |
| 4 | Niedrig | canTeacher Edge Case ohne teacherId | Akzeptiert |
| 5 | Niedrig | GET admin-access lesbar für alle Admins | Akzeptiert (Frontend schränkt ein) |

## Reiterleiste im TeacherForm

| Tab | Sichtbar wenn | Badge |
|-----|--------------|-------|
| Stammdaten | Immer | — |
| Beratungslehrkraft | BL-Modul aktiv | "Aktiv" wenn aktiviert |
| Schulsozialarbeit | SSW-Modul aktiv | "Aktiv" wenn aktiviert |
| Adminrechte | Bearbeitung + Superadmin | Anzahl vergebener Rechte |

## Qualitäts-Check

| Metrik | Status |
|--------|--------|
| Frontend-Build | Erfolgreich |
| Backend-Tests | 61/61 grün |
| Security-Review | 1 Hoch behoben, 0 Kritisch |
