# Vertriebsanalyse eduVite – Wettbewerbsvorteile

> **Stand:** 2026-03-19
> **Zweck:** Argumentationsgrundlage fuer Vertrieb, Investorengespraeche und Positionierung
> **Zielgruppe:** Gruendungsteam, potenzielle Investoren, Pilotkunden

---

## 1. Executive Summary

eduVite ist eine modulare, selbst-hostbare Schulverwaltungsplattform mit Fokus auf
Elternsprechtage, Schulsozialarbeit und Beratungslehrer-Terminvergabe. Die Plattform
hebt sich durch **echte Datensouveraenitaet**, **modulare Architektur** und
**professionelles UI-Design** vom Wettbewerb ab.

---

## 2. Marktueberblick – Wettbewerber

### 2.1 Spezialisierte Loesungen

| Anbieter | Fokus | Preis | Hosting | Schwaechen aus eduVite-Sicht |
|----------|-------|-------|---------|------|
| **Schulmanager Online** | Ganzheitliches Schulmanagement | 169 EUR/Jahr (Elternsprechtag-Modul) | SaaS (DE-Server) | Kein Self-Hosting, kein Quellcode-Zugang, Feature-Bloat fuer Schulen die nur Sprechtage brauchen |
| **schoolboost** | Schnelle Elternsprechtag-Organisation | Auf Anfrage | SaaS | Keine SSW/BL-Module, kein DSGVO-Tiefgang, eingeschraenkte Anpassbarkeit |
| **DieSchulApp** | Schulkommunikation + Sprechtage | Auf Anfrage | SaaS | Primaer Kommunikations-App, Buchungslogik ist Nebenfunktion |
| **EST-System** | Reine Elternsprechtag-Loesung | Pay-per-Event | SaaS | Veraltet wirkendes UI, kein Modulsystem, keine Erweiterbarkeit |
| **elternsprechtag-online.de** | Reine Elternsprechtag-Loesung | Auf Anfrage | SaaS | Nur Sprechtage, keine Beratungs-Module |
| **Calendato** | Allg. Terminbuchung | Auf Anfrage | SaaS | Nicht schulspezifisch, kein Rollen-/Modulkonzept |
| **edoop.de** | Modulares Schulmanagement | Modular | SaaS (DE) | SaaS-only, kein Self-Hosting |

### 2.2 Tech-Giants

| Anbieter | Produkt | Schwaechen aus eduVite-Sicht |
|----------|---------|------|
| **Microsoft** | Bookings (M365 Education A3+) | DSGVO hochproblematisch: CLOUD Act, Telemetrie, DSK-Warnung, mehrere Bundeslaender verbieten Einsatz. Keine schulspezifische Logik. Kein SSW/BL-Modul. Abhaengigkeit von Microsoft-Lizenzmodell. |
| **Google** | Google Calendar / Appointment Scheduling | Gleiche DSGVO-Problematik wie Microsoft. Keine Rollen (Admin/Lehrkraft/SSW). Nicht auf Schulkontext zugeschnitten. |

---

## 3. Vertriebsargumente (USPs)

### 3.1 Datensouveraenitaet und DSGVO

**Das staerkste Argument im deutschen Schulmarkt.**

| Merkmal | eduVite | Typischer SaaS-Wettbewerber | Microsoft/Google |
|---------|---------|---------------------------|------------------|
| Hosting-Kontrolle | Self-Hosted (eigener Server / Schul-RZ) | Anbieter-Cloud | US-Cloud (CLOUD Act) |
| Serverstandort | Vom Kunden bestimmt (DE/EU) | DE (meist) | EU-RZ, aber US-Jurisdiktion |
| Datenhoheit | 100% beim Kunden | Beim Anbieter (AV-Vertrag) | Bei Microsoft/Google |
| Quellcode-Zugang | Vollstaendig | Nicht moeglich | Nicht moeglich |
| Vendor Lock-in | Keiner (Standard-Stack: PostgreSQL, Docker) | Mittel bis hoch | Sehr hoch (Oekosystem) |
| Telemetrie/Tracking | Keine | Unklar | Umfangreich, kaum deaktivierbar |
| Sub-Prozessoren | Keine (Self-Hosted) | Liste variiert | Dutzende |

**Konkrete DSGVO-Features (implementiert und geplant):**

- Consent-Management mit Receipts (Timestamp, Version, Zweck)
- Konfigurierbare Aufbewahrungsfristen (Retention-Engine)
  - Buchungsanfragen: 180 Tage
  - SSW-Termine: 365 Tage
  - BL-Termine: 365 Tage
  - Stornierungen: 30 Tage
  - Audit-Log: 730 Tage
- Automatische Anonymisierung nach Fristablauf (Cron-Job)
- Betroffenenrechte-API: Export, Loeschung, Einschraenkung, Portabilitaet
- Audit-Log (append-only) fuer Rechenschaftspflicht
- Physische Mandantentrennung (VPS + eigene DB pro Schule)
- Keine Cookies ausser httpOnly Session-JWT (keine Cookie-Banner noetig)
- Vorbereitung auf DSFA (Datenschutz-Folgenabschaetzung)
- Umfassender DSGVO-Anforderungskatalog als Entwicklungs-Leitfaden

**Vertriebsargument:**
> "Bei eduVite verlassen Schueler- und Beratungsdaten nie den Server Ihrer Schule.
> Kein CLOUD Act, keine US-Telemetrie, kein AV-Vertrag mit Drittanbietern noetig.
> Die Datenschutzbeauftragten Ihres Bundeslandes werden es Ihnen danken."

**Regulatorischer Kontext (Stand 2025/2026):**
- Die Deutsche Datenschutzkonferenz (DSK) stuft Microsoft 365 als "kaum DSGVO-konform nutzbar" ein
- Baden-Wuerttemberg hat den Einsatz von Microsoft 365 an Schulen untersagt
- Schleswig-Holstein hat 2025 den kompletten Verzicht auf Microsoft-Produkte in der Landesverwaltung beschlossen
- Der CLOUD Act erlaubt US-Behoerden Zugriff auf Daten – auch wenn Server in der EU stehen
- eduVite als deutsches Self-Hosted-Produkt ist von all dem nicht betroffen

---

### 3.2 Modulare Architektur

eduVite ist kein monolithisches "alles oder nichts"-System. Schulen aktivieren nur
die Module, die sie brauchen:

| Modul | Funktion | Status |
|-------|----------|--------|
| **Elternsprechtag** | Zeitslot-Buchung, Lehrkraft-Zuordnung, Fachlogik | Produktionsreif |
| **Schulsozialarbeit (SSW)** | Beratungstermine, Anliegen-Kategorien, Schueler-Bezug | Produktionsreif |
| **Beratungslehrer (BL)** | Beratungstermine, Terminverwaltung, Notizen | Produktionsreif |

**Architektur-Vorteile:**
- Module sind unabhaengig deploybar (ENABLED_MODULES Env-Variable)
- Frontend und Backend registrieren Module getrennt
- Neue Module ohne Aenderung am Kern moeglich
- Jedes Modul hat eigene Routen, Migrationen, Komponenten
- Modularer Zugang pro User (user_module_access)

**Laufzeit-Toggle:**
Superadmins koennen Module ueber das UI aktivieren/deaktivieren – ohne Neustart,
ohne Deployment. Die `module_config`-Tabelle steuert die Sichtbarkeit zur Laufzeit.

**Vertriebsargument:**
> "Sie zahlen und deployen nur was Sie brauchen. Neue Module koennen jederzeit
> aktiviert werden – ohne Migration, ohne Neuinstallation."

---

### 3.3 Professionelles Design

Das UI von eduVite ist kein "Open-Source-Look", sondern ein durchdachtes Design-System:

**Design-System:**
- 100+ CSS Custom Properties (Design Tokens) fuer konsistentes Theming
- Markenfarben ueber `var(--brand-*)` – schulspezifisches Branding moeglich
- Modulspezifische Akzentfarben fuer visuelle Orientierung
- Glassmorphic Cards mit Backdrop-Filter und Tiefenstaffelung
- Manrope-Schriftart (modern, gut lesbar)
- Semantische Status-Farben (Erfolg, Warnung, Fehler, Info)

**Responsive Design (10 Breakpoints):**
- Desktop (1200px+) bis Ultra-Small (375px, iPhone SE)
- Admin-Tabellen transformieren zu Card-Layout auf Mobil
- Sidebar wird Off-Canvas-Menue auf kleinen Screens
- iOS-spezifische Optimierungen (Safe Area Insets, Scroll-Performance)
- Touch-freundlich: min. 48px Touch-Targets

**Barrierefreiheit (a11y):**
- ARIA-Labels, aria-live-Regions, aria-expanded States
- Focus-Management in Sidebars (Focus-Trap + Restore)
- Keyboard-Navigation (Tab, Escape, Pfeiltasten)
- `prefers-reduced-motion` Support
- `:focus-visible` statt `:focus` (kein Fokus-Ring bei Maus-Nutzung)

**Micro-Interactions:**
- Ripple-Effekte auf Buttons
- Smooth State-Transitions (120-300ms, GPU-beschleunigt)
- Pulsierendes Notification-Badge
- Animated Logo (SVG Stroke-Animation)

**Dynamisches Branding (Superadmin-Panel):**
- Schulname, Logo, Primaerfarbe, Sekundaerfarbe per UI anpassbar
- Hero-Text, Hintergrundbilder, Modul-Kachel-Bilder konfigurierbar
- E-Mail-Branding (Logo, Farben, Footer-Text) individualisierbar
- DSB-Kontakt, Verantwortlicher, Aufsichtsbehoerde fuer Datenschutzseite pflegbar
- Alles per `BrandingContext` zur Laufzeit – kein Rebuild noetig

**Vertriebsargument:**
> "Eltern oeffnen die Buchungsseite auf dem Handy und es funktioniert einfach –
> ohne App-Download, ohne Anmeldung. Lehrkraefte bekommen ein professionelles
> Admin-Interface das Spass macht. Und Ihre Schule bekommt ihr eigenes Branding –
> Farben, Logo, Texte – alles per Klick anpassbar."

---

### 3.4 Technischer Stack

| Schicht | Technologie | Vorteil |
|---------|-------------|---------|
| Frontend | React 19, TypeScript 5.9, Vite 7 | Aktuellster Stack, schnelle Builds, Typsicherheit |
| Backend | Node.js 20 (ESM), Express | Bewährt, riesiges Oekosystem, leicht wartbar |
| Datenbank | PostgreSQL 16 | Enterprise-DB, keine Lizenzkosten, alle Features |
| Deployment | Docker Compose (3 Services) | Ein Befehl, laeuft ueberall, reproduzierbar |
| Auth | JWT (httpOnly Cookie) | Sicher, stateless, kein Session-Store noetig |
| E-Mail | Nodemailer | Flexibel: Ethereal (Dev), beliebiger SMTP (Prod) |
| Logging | Pino (JSON) | Strukturiert, performant, SIEM-kompatibel |

**Keine externen Abhaengigkeiten:**
- Kein Firebase, kein Supabase, kein Auth0
- Kein CDN-Zwang (alles self-contained)
- Kein Cloud-Provider Lock-in
- Standard-Technologien = grosser Talentpool fuer Weiterentwicklung

**Vertriebsargument:**
> "Docker Compose starten, fertig. Keine Cloud-Abos, keine versteckten Kosten,
> keine Abhaengigkeit von Drittdiensten. Laeuft auf jedem 5-EUR-VPS."

---

### 3.5 Superadmin-Panel (Alleinstellung)

Kein Wettbewerber bietet ein vergleichbar umfassendes Self-Service-Administrations-Panel:

| Tab | Funktion |
|-----|----------|
| **Module** | Module per Toggle aktivieren/deaktivieren (Laufzeit) |
| **Branding** | Schulname, Logo, Farben, Hero-Text, Modul-Kachel-Bilder |
| **Hintergruende** | Hintergrundbild pro Seite (Landing, Admin, je Modul) |
| **E-Mail** | E-Mail-Branding konfigurieren, Test-Mail senden |
| **Texte** | Buchungsseite-Texte, Event-Banner, Modal-Texte anpassen |
| **Datenschutz** | DSAR-Interface (Art. 15-21): Suche, Export, Berichtigung, Loeschung, Einschraenkung + Audit-Log-Viewer |

**Vertriebsargument:**
> "Ihre Schulleitung kann alles selbst konfigurieren – Farben, Logo, Texte,
> Module, Datenschutz-Anfragen. Kein Ticket, kein Warten auf den Support."

---

### 3.6 Double-Opt-In und E-Mail-Workflow

| Schritt | Ablauf |
|---------|--------|
| 1 | Elternteil bucht Termin auf Buchungsseite |
| 2 | Verifikations-E-Mail mit Token-Link (Double-Opt-In) |
| 3 | Elternteil klickt Link → Buchung wird verifiziert |
| 4 | Lehrkraft sieht Anfrage → bestätigt mit Zeitfenster-Auswahl |
| 5 | Bestaetigungs-E-Mail an Elternteil (mit Deduplizierungs-Schutz) |
| 6 | Optional: Stornierungsmail bei Admin-/Lehrkraft-Stornierung |

- Token wird nur als Hash gespeichert (Klartext nur in URL)
- Konfigurierbare TTL (Default: 72h)
- Datenschutz-Footer in allen E-Mails
- E-Mail-Branding individualisierbar per Superadmin

---

### 3.7 Sicherheits-Architektur

| Feature | Details |
|---------|---------|
| Authentifizierung | JWT in httpOnly Secure Cookie, Token-Versionierung, Force Password Change |
| Autorisierung | RBAC (Superadmin, Admin, Teacher, SSW, BL) + modul-basierte Zugangssteuerung |
| SQL Injection | 100% parametrisierte Queries ($1, $2, ...) |
| XSS | React Default-Escaping + CSP-ready |
| Rate Limiting | Auf allen oeffentlichen Endpoints |
| Brute Force | Account-Lockout nach Fehlversuchen |
| Password Hashing | bcrypt mit Salt Rounds |
| CORS | Explizite Origin-Whitelist |
| Port Security | Nur Loopback-Binding (127.0.0.1) – Reverse-Proxy Pflicht |
| DB-Sicherheit | Pool-Parameter-Validierung, SSL-Unterstuetzung, Pfad-Traversal-Schutz |

---

### 3.8 Rollen und Berechtigungssystem

| Rolle | Funktionen |
|-------|-----------|
| **Superadmin** | Systemweite Einstellungen, Datenschutz-Tab, DSAR-Verwaltung, alle Module |
| **Admin** | Lehrkraft-Verwaltung (CRUD + CSV-Import), Event-Management |
| **Teacher** | Eigene Termine/Slots verwalten, Passwort aendern |
| **SSW** | Schulsozialarbeit-Termine und -Faelle verwalten |
| **Beratungslehrer** | Beratungstermine verwalten |

Modulzugang ist pro User konfigurierbar (user_module_access-Tabelle).

---

## 4. Positionierung vs. Wettbewerb

### 4.1 Gegen SaaS-Anbieter (Schulmanager, schoolboost, etc.)

| Argument | Detail |
|----------|--------|
| **Datensouveraenitaet** | Self-Hosting = keine Daten bei Dritten. Kein AV-Vertrag noetig. |
| **Kostenstruktur** | Einmalig oder Abo (flexibel), kein Pay-per-Event. Kein Feature-Gating. |
| **Anpassbarkeit** | Quellcode-Zugang, eigenes Branding, eigene Module moeglich. |
| **Kein Vendor Lock-in** | PostgreSQL-Export, Standard-Docker, kein proprietaeres Format. |
| **Beratungs-Module** | SSW und BL als First-Class-Module – das bietet fast kein Wettbewerber. |

### 4.2 Gegen Microsoft Bookings

| Argument | Detail |
|----------|--------|
| **DSGVO-Konformitaet** | Kein CLOUD Act, keine US-Telemetrie, keine DSK-Warnung. Mehrere Bundeslaender (BaWue, SH) verbieten Microsoft in Schulen. |
| **Schulspezifisch** | Rollen, Module, Schueler-Bezug, Feedback – alles schulspezifisch. Bookings ist ein generisches Termin-Tool. |
| **Keine Lizenzkosten** | Bookings erfordert M365 A3+ Lizenz. eduVite laeuft auf Standard-Linux. |
| **Unabhaengigkeit** | Kein Microsoft-Oekosystem noetig. Keine Azure AD, kein Teams, kein SharePoint. |

### 4.3 Gegen "Excel + E-Mail" (Status Quo vieler Schulen)

| Argument | Detail |
|----------|--------|
| **Zeitersparnis** | Automatische Terminvergabe statt manueller Koordination |
| **Fehlerreduktion** | Keine Doppelbuchungen, keine vergessenen E-Mails |
| **Eltern-Zufriedenheit** | Mobile-optimierte Selbstbuchung, kein Zettel-Chaos |
| **Nachweisbarkeit** | Audit-Log, Consent-Tracking – wichtig bei Elternbeschwerden |

---

## 5. Zielgruppensegmente

| Segment | Schmerz | eduVite-Loesung |
|---------|---------|-----------------|
| **Datenschutzbeauftragte** | Microsoft/Google-Verbote, AV-Vertrags-Chaos | Self-Hosting, keine Drittanbieter, DSGVO-by-Design |
| **Schulleitungen** | Zeitaufwand Elternsprechtag-Organisation | Automatische Buchung, Admin-Dashboard |
| **Schulsozialarbeiter** | Keine digitale Terminverwaltung | Eigenes SSW-Modul mit Anliegen-Kategorien |
| **IT-Beauftragte Schulen** | Wildwuchs an Tools, kein Self-Hosting | Docker Compose, ein System fuer alles |
| **Schultraeger / Kommunen** | Einheitliche Loesung fuer mehrere Schulen | Multi-Tenancy (VPS pro Schule), zentral verwaltbar |

---

## 6. Schwaechen / Ehrliche Einschaetzung

| Schwaeche | Mitigation |
|-----------|------------|
| Self-Hosting erfordert IT-Kompetenz | Managed-Hosting-Angebot planen (eduVite hosted) |
| Kein nativer App-Store-Eintrag | PWA-Faehigkeit anstreben (Add to Homescreen) |
| Kleinerer Feature-Umfang als Schulmanager | Fokus ist Staerke: Buchung + Beratung, nicht "alles" |
| Noch kein Multi-Tenancy-SaaS-Modus | Physische Isolation (VPS/Schule) ist DSGVO-sicherer |
| Keine Laufweg-Optimierung (wie Schulmanager) | Feature-Kandidat fuer spaeter |
| Community/Support noch klein | Persoenlicher Support als Gruendungsvorteil |

---

## 7. Preismodell-Ueberlegungen

| Modell | Beschreibung | Zielgruppe |
|--------|-------------|------------|
| **Self-Hosted Free** | Quellcode frei, Community-Support | Technikaffine Schulen, Schultraeger mit eigenem RZ |
| **Self-Hosted + Support** | Lizenz + SLA + Updates | Schulen mit IT-Budget |
| **Managed Hosting** | eduVite betreibt VPS pro Schule | Schulen ohne IT-Kompetenz |
| **Schultraeger-Paket** | Mehrere Instanzen, zentrale Verwaltung | Kommunen, Landkreise |

---

## 8. Quellen und Referenzen

### Wettbewerber
- [Schulmanager Online – Elternsprechtag](https://www.schulmanager-online.de/module.elternsprechtag.html)
- [schoolboost – Elternsprechtag](https://schoolboost.de/elternsprechtag/)
- [DieSchulApp – Elternsprechtag](https://www.dieschulapp.de/elternsprechtag/)
- [EST-System](https://www.est-system.de/)
- [elternsprechtag-online.de](https://www.elternsprechtag-online.de/)
- [Calendato – Terminbuchung Schule](https://www.calendato.com/de/terminbuchung-schule.html)
- [Microsoft Bookings fuer Elternsprechtag](https://www.malter365.de/bookings/elternsprechtag/)
- [Schulsoftware-Vergleich](https://schulsoftware-vergleich.de/)

### DSGVO und Microsoft an Schulen
- [Schulmanager Online Datenschutz](https://www.schulmanager-online.de/datenschutz.html)
- [datenschutz-schule.info – Schulmanager](https://datenschutz-schule.info/tag/schulmanager-online/)
- [Microsoft Bookings und DSGVO (Zeeg)](https://zeeg.me/de/blog/content/microsoft-bookings-dsgvo)
- [Microsoft 365 an Schulen – DSGVO-Verstoesse (Born)](https://borncity.com/blog/2023/02/12/microsoft-365-an-schulen-droht-bald-schadensersatz-bugeld-wegen-dsgvo-versten/)
- [US-Recht gefaehrdet Datensouveraenitaet (Security Insider)](https://www.security-insider.de/us-recht-datensouveraenitaet-eu-rechenzentren-a-1ccc4f60daa2832573b75b7011de053a/)
- [Datenschutz bei IT-Tools in Schulen (Dr. Datenschutz)](https://www.dr-datenschutz.de/datenschutz-bei-it-tools-software-in-schulen/)

### Interne Referenzen
- [DSGVO-Anforderungskatalog](../compliance/dsgvo-anforderungen.md)
- [DSGVO-Dateninventar](../compliance/dsgvo-dateninventar.md)
- [Security Baseline](../security/security-baseline.md)
- [System-Architektur](../architecture/system-design.md)
- [Modul-Guide](../architecture/module-guide.md)
