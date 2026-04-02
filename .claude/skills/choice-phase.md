# /choice-phase

> Referenz: `docs/planning/choice-module-plan.md`

**Trigger:** "Implementiere Phase X" oder "Starte Phase X des Choice-Moduls"

Zweck: Erzwingt den Pflicht-Agenten-Workflow und standardisiert die Reihenfolge pro Umsetzungsphase.

## Workflow

1. **Phase identifizieren** — Lies `docs/planning/choice-module-plan.md` Abschnitt 10, bestimme welche Phase gemeint ist
2. **Erkunder** — Spawne `erkunder` Agent: betroffene Dateien, Abhaengigkeiten, Seiteneffekte kartieren
3. **Entscheidung: Architekt noetig?**
   - JA wenn: Multi-File-Aenderung, DB-Schema, neuer Service, neues API-Pattern, Strukturaenderung
   - NEIN wenn: einzelne Datei, reines UI-Tweak, Bugfix innerhalb bestehender Struktur
   - Im Zweifel: JA
4. **Architekt** (wenn noetig) — Spawne `architekt` Agent: Dateiliste, Reihenfolge, Contracts
5. **Implementierung** — Backend vor Frontend. Eine logische Aenderung pro Commit
6. **Modulwaechter** — Spawne `modulwaechter` Agent: Registry, Manifest, Routen-Konformitaet pruefen
7. **Pruefer** — Spawne `pruefer` Agent: alle Findings Kritisch/Hoch fixen vor Commit
8. **Build pruefen** — `npm run build` bei Frontend-Aenderungen
9. **Commit + Push** — Conventional Commit Format, Push auf Feature-Branch

## Regeln

- Schritte 2, 6, 7 sind IMMER Pflicht, auch bei kleinen Aenderungen
- Schritt 3+4 duerfen nur uebersprungen werden mit expliziter Begruendung
- Bei Schritt 7 Findings: Fix → erneut pruefen → erst dann committen
- Jede Phase darf mehrere Commits enthalten, aber jeder Commit durchlaeuft Schritt 7
