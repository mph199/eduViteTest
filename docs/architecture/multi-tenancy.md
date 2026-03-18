# Multi-Tenancy-Architektur

> **Stand:** 2026-03-18 | **Version:** 1.0
> **Entscheidung:** VPS + separate Datenbank pro Schule (keine Shared Databases)

---

## 1. Architektur-Entscheidung

### Bewertete Optionen

| Option | Beschreibung | Verworfen weil |
|--------|-------------|----------------|
| A: Shared DB + tenant_id | Alle Schulen in einer DB, RLS mit tenant_id | Risiko mandantenuebergreifender Datenlecks, komplexe Migration |
| B: Schema-pro-Mandant | Separate PostgreSQL-Schemas pro Schule | Backup/Restore-Komplexitaet, Schema-Drift |
| **C: VPS + separate DB** | **Jede Schule auf eigenem VPS mit eigener DB** | **Gewaehlt** |

### Entscheidungsgruende

1. **Maximale Datenisolation** – Physische Trennung erfuellt Art. 32 DSGVO (Stand der Technik) ohne zusaetzliche Software-Massnahmen
2. **Einfache DSGVO-Compliance** – Loeschung einer Schule = VPS + DB loeschen. Kein Risiko, Daten anderer Schulen zu beruehren.
3. **Kein Code-Overhead** – Kein `tenant_id` in jeder Query, kein RLS-Management, keine Multi-Tenant-Middleware
4. **Unabhaengige Skalierung** – Jede Schule kann individuell skaliert werden (mehr RAM, CPU)
5. **Unabhaengige Updates** – Schulen koennen zu unterschiedlichen Zeitpunkten aktualisiert werden
6. **Einfacheres Debugging** – Probleme sind auf eine Instanz begrenzt

### Nachteile und Mitigationen

| Nachteil | Mitigation |
|----------|-----------|
| Hoehere Infrastrukturkosten | VPS-Kosten sind gering (~5-10 EUR/Monat pro Schule) |
| Update-Aufwand ueber viele Instanzen | Automatisierung via Ansible/Docker (Aufgabe 2.1.6) |
| Kein zentrales Dashboard | Zentrales Monitoring einrichten (Aufgabe 2.1.7) |
| Kein Cross-School-Reporting | Nicht geplant; bei Bedarf: Aggregation aus Monitoring-Daten |

---

## 2. Architektur-Uebersicht

```
                    ┌────────────────────────────┐
                    │   Zentrales Management      │
                    │   (Provisioning, Updates,    │
                    │    Monitoring, Backups)       │
                    └──────────┬─────────────────┘
                               │
              ┌────────────────┼────────────────┐
              v                v                v
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │  VPS Schule A    │ │  VPS Schule B    │ │  VPS Schule C    │
    │  ┌─────────────┐ │ │  ┌─────────────┐ │ │  ┌─────────────┐ │
    │  │ Frontend    │ │ │  │ Frontend    │ │ │  │ Frontend    │ │
    │  │ (nginx)     │ │ │  │ (nginx)     │ │ │  │ (nginx)     │ │
    │  └──────┬──────┘ │ │  └──────┬──────┘ │ │  └──────┬──────┘ │
    │  ┌──────┴──────┐ │ │  ┌──────┴──────┐ │ │  ┌──────┴──────┐ │
    │  │ Backend     │ │ │  │ Backend     │ │ │  │ Backend     │ │
    │  │ (Express)   │ │ │  │ (Express)   │ │ │  │ (Express)   │ │
    │  └──────┬──────┘ │ │  └──────┬──────┘ │ │  └──────┬──────┘ │
    │  ┌──────┴──────┐ │ │  ┌──────┴──────┐ │ │  ┌──────┴──────┐ │
    │  │ PostgreSQL  │ │ │  │ PostgreSQL  │ │ │  │ PostgreSQL  │ │
    │  │ (DB Schule A)│ │ │  │ (DB Schule B)│ │ │  │ (DB Schule C)│ │
    │  └─────────────┘ │ │  └─────────────┘ │ │  └─────────────┘ │
    └─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Pro VPS

- 1x Docker Compose Stack (3 Container: Frontend, Backend, PostgreSQL)
- Eigene `.env` mit schulspezifischer Konfiguration
- Eigene Domain/Subdomain (z.B. `schuleA.example.de`)
- Eigenes TLS-Zertifikat (Let's Encrypt via Reverse Proxy)
- Eigene Backups

---

## 3. DSGVO-Konsequenzen

### Vorteile

| DSGVO-Aspekt | Umsetzung |
|-------------|-----------|
| **Datenisolation (Art. 32)** | Physische Trennung – kein Cross-Tenant-Zugriff moeglich |
| **Loeschung (Art. 17)** | Gesamte Instanz loeschen = alle Daten weg |
| **Auftragsverarbeitung (Art. 28)** | AV-Vertrag pro Schule, klare Zuordnung |
| **Datenresidenz** | VPS-Standort pro Schule waehlbar (DE/EU) |
| **Audit** | Logs isoliert pro Instanz |
| **Backup** | Schulspezifische Backup-Strategie moeglich |

### AV-Vertrag

Jede Schule schliesst einen AV-Vertrag mit dem Betreiber. Vorlage: `docs/compliance/av-verzeichnis.md`.

Der Betreiber verwaltet:
- VPS-Infrastruktur (Hosting-Provider als Unterauftragsverarbeiter)
- Software-Updates
- Backups
- Monitoring

---

## 4. Deployment-Workflow (geplant)

### Neue Schule einrichten

1. VPS bei Provider bestellen (IONOS, Hetzner, etc.)
2. Provisioning-Skript ausfuehren:
   - Docker + Docker Compose installieren
   - Repository klonen
   - `.env` aus Template generieren (Secrets, Schuldaten)
   - `docker compose up -d`
   - Migrations laufen automatisch
   - DNS + TLS konfigurieren
3. Superadmin-Zugang an Schule uebergeben
4. Schule konfiguriert: Branding, Module, Lehrkraefte

### Updates ausrollen

1. Neues Docker-Image bauen und in Registry pushen
2. Ansible-Playbook ueber alle VPS-Instanzen:
   - `docker compose pull`
   - `docker compose up -d`
   - Health-Check
   - Bei Fehler: automatischer Rollback

### Schule offboarden

1. Datenexport (Art. 20) auf Anfrage
2. VPS und alle Daten loeschen
3. Backups nach 30 Tagen vernichten
4. Dokumentation im Loeschprotokoll

---

## 5. Offene Aufgaben

| # | Aufgabe | Prioritaet | Status |
|---|---------|------------|--------|
| 1 | Provisioning-Skript erstellen | P2 | Offen |
| 2 | Ansible-Playbook fuer Updates | P2 | Offen |
| 3 | Zentrales Monitoring (Uptime, Health) | P2 | Offen |
| 4 | Backup-Automatisierung pro VPS | P2 | Offen |
| 5 | Docker-Registry fuer Images | P3 | Offen |
| 6 | Offboarding-Checkliste | P3 | Offen |

---

## 6. Aenderungshistorie

| Datum | Version | Aenderung |
|-------|---------|-----------|
| 2026-03-18 | 1.0 | Erstversion: Entscheidung VPS + separate DB pro Schule |
