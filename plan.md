# Plan: BL-Counselor in Benutzerverwaltung integrieren + Sidebar aufraumen

## Problem

1. **"+Neuer Beratungslehrer"-Button** in BLAdmin dupliziert Benutzeranlage-Logik, die bereits in AdminTeachers existiert. BL-Counselor-Erstellung soll in das zentrale Benutzerformular integriert werden.
2. **Sidebar zeigt BL-Nutzern falsche Links**: Ein Beratungslehrer sieht "Sprechzeiten" (Elternsprechtag-Modul) und "Schulsozialarbeit" — beides irrelevant fuer seine Rolle.

## Loesung

### Teil 1: Sidebar — moduleAdminRoutes nach Modulzugang filtern

**Datei:** `src/components/GlobalTopHeader.tsx`

- Im Ast 2 (SSW-Rolle oder BL-Ansicht) die `moduleAdminRoutes` filtern:
  - SSW-User (`role === 'ssw'`) sieht nur Routes deren Modul-Key `schulsozialarbeit` ist
  - BL-Teacher (`activeView === 'beratungslehrer'`) sieht nur Routes deren Modul-Key `beratungslehrer` ist
- Dafuer muss jede `AdminRoute` wissen, zu welchem Modul sie gehoert. Das ist bereits moeglich: beim `flatMap` in `moduleAdminRoutes` das `moduleKey` (= `m.id`) mit durchreichen.

**Aenderungen:**
1. `moduleAdminRoutes` um `moduleKey: string` erweitern
2. Im Ast 2 filtern: `moduleAdminRoutes.filter(ar => ar.moduleKey === relevantModule)`
3. Fuer SSW: `relevantModule = 'schulsozialarbeit'`, fuer BL: `relevantModule = 'beratungslehrer'`

### Teil 2: Beratungslehrer-Sprechzeiten im Benutzerformular

**Ziel:** Wenn ein Admin einen Benutzer anlegt/bearbeitet, kann er optional "Beratungslehrer-Sprechzeiten" aufklappen und die BL-spezifischen Felder ausfuellen. Dadurch wird:
- Der User als Teacher angelegt (wie bisher)
- Ein `bl_counselors`-Eintrag erstellt/aktualisiert
- `user_module_access` mit `beratungslehrer` gesetzt
- Ein Wochenplan (`bl_weekly_schedule`) gespeichert

**Frontend — `src/pages/AdminTeachers.tsx`:**
1. Aufklappbare Sektion "Beratungslehrer" im Create/Edit-Formular (nur sichtbar wenn Modul `beratungslehrer` aktiv)
2. Felder: Raum, Telefon, Schwerpunkte, Termindauer, Wochenplan (Tag-Toggle + Start-/Endzeit pro Tag)
3. State `blData` mit den BL-spezifischen Feldern + `enabled: boolean` (Checkbox/Toggle)
4. Beim Submit: Wenn `blData.enabled`, die BL-Daten als `beratungslehrer`-Objekt im Payload mitschicken

**Backend — `backend/routes/admin.js`:**
1. `POST /admin/teachers` und `PUT /admin/teachers/:id` erweitern:
   - Wenn `req.body.beratungslehrer` vorhanden:
     - `bl_counselors`-Eintrag erstellen/updaten (UPSERT auf `user_id`)
     - `user_module_access` setzen (`INSERT ... ON CONFLICT DO NOTHING`)
     - `bl_weekly_schedule` schreiben
   - Wenn `req.body.beratungslehrer` nicht vorhanden aber vorher existierte:
     - Optional: BL-Zugang entfernen? → Erstmal nicht, nur hinzufuegen

**API-Client — `src/services/api.ts`:**
- Typ des Payloads erweitern um optionales `beratungslehrer`-Objekt

### Teil 3: "+Neuer Beratungslehrer"-Button in BLAdmin anpassen

**Datei:** `src/modules/beratungslehrer/pages/BLAdmin.tsx`

Zwei Optionen:
- **Option A (minimal):** Button entfernen, stattdessen Hinweis "Beratungslehrer werden ueber Benutzer & Rechte angelegt"
- **Option B (komfortabel):** Button behalten, aber als Link zu AdminTeachers mit Query-Param `?newBL=true` der das Formular direkt mit aufgeklappter BL-Sektion oeffnet

**Empfehlung:** Option A fuer den Anfang — einfacher, weniger Fehlerquellen. Die BLAdmin-Seite bleibt fuer Terminverwaltung und Themen zustaendig.

## Reihenfolge

1. Sidebar filtern (schnell, eigenstaendig)
2. Backend: Teacher-CRUD um BL-Daten erweitern
3. Frontend: AdminTeachers-Formular um BL-Sektion erweitern
4. BLAdmin: Counselor-CRUD-Tab anpassen (entweder entfernen oder readonly machen)
5. Build pruefen
6. Pruefer laufen lassen

## Entscheidungen

- **BL-Button in BLAdmin:** Entfernen + Hinweis (Option A)
- **BL-Haken entfernen:** `bl_counselors.active = false` setzen (deaktivieren, nicht loeschen)
- **Auto-Aufklappen:** Nein, BL-Sektion immer zugeklappt (Admin muss manuell oeffnen)
