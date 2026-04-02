# Plan: Modul „Differenzierungswahl"

> v1-Plan. Kompakt, entscheidungsorientiert, umsetzungsnah.

## 1. Zielbild

- Strukturierte Wunschabgabe für Differenzierungsfächer unter konfigurierbaren Wahldächern
- Admin erstellt Wahldächer (`ChoiceGroup`) mit Optionen (`ChoiceOption`), pflegt Teilnehmerlisten, versendet Einladungen
- Teilnehmer:innen verifizieren sich per E-Mail-Token, geben priorisierte Wünsche ab
- **Nicht enthalten in v1:** Kapazitäten, automatische Zuweisung, Lehrkräfte, Schüler-Logins, Restplatzvergabe

## 2. Kernentscheidungen

- **Public Access via E-Mail-Token:** Verifizierungslink per Mail → Short-lived JWT in httpOnly Cookie (`choice_session`, getrennt vom Admin-JWT)
- **Kein Schüler-Account:** Identifikation über E-Mail + Name als `ChoiceParticipant`
- **Flaches Teilnehmermodell (Variante A):** Participants hängen direkt an der Group mit optionalem `audience_label` (z.B. „Klasse 9a"). Keine separate `choice_audiences`-Tabelle in v1
- **Wunschanzahl konfigurierbar:** `min_choices` / `max_choices` pro Group
- **Ranking explizit konfigurierbar:** `ranking_mode` = `none` | `required` auf Group-Ebene
- **Statusmodell ChoiceGroup:** `draft` → `open` → `closed` → `archived`
- **Statusmodell ChoiceSubmission:** `draft` → `submitted` (Bearbeitung erlaubt solange Group `open`)
- **Keine Hard Deletes** für fachliche Datensätze – stattdessen `is_active` auf Options und Participants
- **Self-Service Re-Invite:** Public Endpoint `request-access` sendet neuen Token, wenn E-Mail in Teilnehmerliste und Group offen

## 3. Fachmodell

- **ChoiceGroup** – Wahldach (Titel, Beschreibung, Status, Wunschkonfiguration, Ranking-Modus, Zeitfenster)
- **ChoiceOption** – Wählbares Fach unter einem Wahldach (Titel, Beschreibung, Sortierung, aktiv/inaktiv)
- **ChoiceParticipant** – Einzelperson in einem Wahldach (Vorname, Nachname, E-Mail, optionales Audience-Label, aktiv/inaktiv)
- **ChoiceSubmission** – Abgabe einer Person für ein Wahldach (Status draft/submitted, Zeitstempel)
- **ChoiceSubmissionItem** – Einzelner Wunsch mit Priorität (Option-Ref, `priority`)
- **ChoiceEmailToken** – Kurzlebiger Verifizierungstoken (Token-Hash, Expiry, single-use)

Beziehungen: Group 1→N Option, Group 1→N Participant, Group+Participant 1→1 Submission, Submission 1→N SubmissionItem → Option

## 4. Datenmodell

Alle Tabellen mit Präfix `choice_`. Migration **063**.

- **`choice_groups`** – `id UUID PK`, `title VARCHAR(255)`, `description TEXT`, `status VARCHAR(20)` (draft/open/closed/archived), `min_choices INT`, `max_choices INT`, `ranking_mode VARCHAR(20)` (none/required), `allow_edit_after_submit BOOLEAN DEFAULT true`, `opens_at TIMESTAMPTZ`, `closes_at TIMESTAMPTZ`, `created_by INT REFERENCES users(id)`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
- **`choice_options`** – `id UUID PK`, `group_id FK → choice_groups ON DELETE CASCADE`, `title VARCHAR(255)`, `description TEXT`, `sort_order INT`, `is_active BOOLEAN DEFAULT true`, `created_at TIMESTAMPTZ`; UNIQUE(group_id, title)
- **`choice_participants`** – `id UUID PK`, `group_id FK → choice_groups ON DELETE CASCADE`, `first_name VARCHAR(100)`, `last_name VARCHAR(100)`, `email VARCHAR(255)`, `audience_label VARCHAR(100)`, `is_active BOOLEAN DEFAULT true`, `created_at TIMESTAMPTZ`; UNIQUE(group_id, email)
- **`choice_submissions`** – `id UUID PK`, `group_id FK → choice_groups ON DELETE CASCADE`, `participant_id FK → choice_participants`, `status VARCHAR(20)` (draft/submitted), `submitted_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`; UNIQUE(group_id, participant_id)
- **`choice_submission_items`** – `id UUID PK`, `submission_id FK → choice_submissions ON DELETE CASCADE`, `option_id FK → choice_options`, `priority INT`, `created_at TIMESTAMPTZ`; UNIQUE(submission_id, option_id), UNIQUE(submission_id, priority)
- **`choice_email_tokens`** – `id UUID PK`, `participant_id FK → choice_participants`, `token_hash VARCHAR(64)`, `expires_at TIMESTAMPTZ`, `used_at TIMESTAMPTZ NULL`, `created_at TIMESTAMPTZ`; INDEX(token_hash)

Cascade: Group → Options, Participants, Submissions. Submissions → Items.

## 5. Backend

Modulpfad: `backend/modules/choice/`

- **index.js** – `register(app, { rateLimiters })`, mountet Admin VOR Public (Pfad-Spezifität)
- **routes/admin.js** – `requireModuleAdmin('choice')`, CRUD für Groups, Options, Participants; Submission-Export; Invite
- **routes/public.js** – Rate-Limited, kein Auth; Verify, Request-Access, Submission-Flow
- **services/choiceService.js** – Geschäftslogik: Statusprüfung, Wunschvalidierung, Zeitfenster, min/max/ranking
- **services/emailService.js** – Verifizierungsmail (Nodemailer, Template)
- **services/tokenService.js** – Token generieren (32 Bytes random), SHA-256 hashen, validieren, TTL konfigurierbar (Default 24h)
- **services/csvService.js** – CSV-Import für Teilnehmerlisten (Parsing, Validierung, Duplikaterkennung)
- **schemas/choice.js** – Zod-Schemas, eingebunden via `validate()`-Middleware
- Kysely für alle Queries, Interfaces in `backend/db/types.ts`

## 6. API

### Admin (Auth, Präfix `/api/choice/admin`)

| Methode | Pfad | Zweck |
|---------|------|-------|
| GET | `/groups` | Liste aller Wahldächer |
| POST | `/groups` | Neues Wahldach anlegen |
| GET | `/groups/:id` | Wahldach-Details |
| PUT | `/groups/:id` | Wahldach bearbeiten |
| POST | `/groups/:id/status` | Statuswechsel |
| GET | `/groups/:id/options` | Optionen auflisten |
| POST | `/groups/:id/options` | Option hinzufügen |
| PUT | `/options/:id` | Option bearbeiten |
| POST | `/options/:id/deactivate` | Option deaktivieren |
| GET | `/groups/:id/participants` | Teilnehmerliste |
| POST | `/groups/:id/participants` | Teilnehmer hinzufügen (einzeln oder CSV) |
| PUT | `/participants/:id` | Teilnehmer bearbeiten |
| POST | `/participants/:id/deactivate` | Teilnehmer deaktivieren |
| GET | `/groups/:id/submissions` | Alle Abgaben (Export-fähig) |
| POST | `/groups/:id/invite` | Einladungsmails senden |

### Public (kein Auth, Präfix `/api/choice/public`, Rate-Limited)

| Methode | Pfad | Zweck |
|---------|------|-------|
| POST | `/verify` | Token validieren → setzt `choice_session` Cookie |
| POST | `/request-access` | Neuen Token anfordern (E-Mail + groupId) |
| GET | `/groups/:id` | Group + aktive Options (nur wenn `open`, Cookie required) |
| GET | `/groups/:id/submission` | Eigene Abgabe anzeigen |
| PUT | `/groups/:id/submission/draft` | Entwurf speichern |
| POST | `/groups/:id/submission/submit` | Final abgeben |

## 7. Public Access

- **Einladung:** Admin sendet Invite → Token pro Participant generiert, Link per E-Mail
- **Link-Format:** `/wahl/:groupId/verify?token=<hex>`
- **Verify:** Backend prüft Token-Hash, setzt httpOnly Cookie mit JWT (`{participantId, groupId, exp: 2h}`)
- **Cookie:** `choice_session`, SameSite=Strict, getrennt vom Admin-JWT `token`
- **Public-Middleware:** prüft `choice_session`-Cookie, extrahiert Participant-Kontext
- **Request-Access:** Teilnehmer:in gibt E-Mail + groupId ein → wenn bekannt und Group offen, neuer Token per Mail; Response immer generisch (keine E-Mail-Enumeration)
- **Rate-Limiting:** Verify/Request-Access: 10/15min pro IP; Submissions: 30/15min pro IP
- **Token:** Single-use (`used_at` gesetzt), TTL 24h, bei Bedarf neuer Token via Request-Access oder Admin-Re-Invite

## 8. Frontend

Modulpfad: `src/modules/choice/`
Registry: `src/modules/registry.ts`, `id: 'choice'`

### Admin-Routen (unter `/choice`)

- **GroupListPage** – Übersicht aller Wahldächer mit Status-Badges
- **GroupDetailPage** – Wahldach bearbeiten, Optionen verwalten, Statuswechsel
- **ParticipantListPage** – Teilnehmer verwalten (manuell + CSV-Import)
- **SubmissionOverviewPage** – Abgaben einsehen, filtern, exportieren

### Public-Routen (unter `/wahl/:groupId`)

- **VerifyPage** (`/wahl/:groupId/verify`) – Token prüfen, Weiterleitung
- **RequestAccessPage** (`/wahl/:groupId`) – E-Mail eingeben für neuen Zugangslink
- **ChoiceFormPage** (`/wahl/:groupId/form`) – Wunschabgabe
- **ConfirmationPage** (`/wahl/:groupId/confirmation`) – Abgabebestätigung

### UI-Patterns für Wunschabgabe

- 1 Wunsch → Radios
- Mehrere ohne Ranking (`ranking_mode: none`) → Checkboxen
- Mehrere mit Ranking (`ranking_mode: required`) → Select-Dropdowns „Erstwunsch / Zweitwunsch / …"

Komponenten: `ChoiceCard`, `PrioritySelect`, `ParticipantTable`, `CSVUploadDialog`, `StatusBadge`

## 9. Validierung und Sicherheit

- **Frontend:** Pflichtfelder, min/max Wunschanzahl, Prioritäts-Eindeutigkeit (bei Ranking), Submit-Button nur wenn valide
- **Backend/Service:** Zod-Validierung aller Inputs; Group muss `open` sein; Zeitfenster-Check (`opens_at`/`closes_at`); Participant muss aktiv und zur Group gehören; Gewählte Options müssen `is_active` sein; Anzahl Items ≥ `min_choices` und ≤ `max_choices`; Bei `ranking_mode: required` alle Priorities 1..N lückenlos
- **DB-Constraints:** UNIQUE als letzte Verteidigungslinie (keine doppelten Submissions, keine doppelten Priorities)
- **Sicherheit:** Parametrisierte Queries (Kysely); SameSite-Cookie; Rate-Limiting auf Public-Routen; Token-Hashing (SHA-256, kein Klartext); generische Fehlermeldungen (keine E-Mail-Enumeration)
- **DSGVO:** `'choice'` in `consentWithdrawSchema` ergänzen

## 10. Umsetzungsphasen

1. **DB + Backend Core** – Migration 063, Kysely-Types, Group/Option CRUD + Services
2. **Participants** – CRUD, CSV-Import, Deaktivierung
3. **Token + Verify** – TokenService, E-Mail-Versand, Verify-Endpoint, Public-Middleware, Request-Access
4. **Submission API** – Draft/Submit-Flow, Validierung, Export
5. **Admin Frontend** – GroupList, GroupDetail, ParticipantList, SubmissionOverview
6. **Public Frontend** – Verify, RequestAccess, ChoiceForm, Confirmation
7. **Polish** – Statusübergänge, Edge Cases, Review

### Risiken

- Public-Cookie (`choice_session`) parallel zum Admin-JWT (`token`) – keine Kollision sicherstellen
- CSV-Import mit großen Listen (>500) – Streaming/Batch
- E-Mail-Delivery in Docker-Dev via Ethereal
- Zeitfenster: immer UTC speichern, Frontend lokalisiert
- `allow_edit_after_submit` sauber mit `closed`-Status kombinieren
