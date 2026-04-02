# /choice-change

> Referenz: `docs/planning/choice-module-plan.md`

**Trigger:** "Aendere X im Choice-Modul" oder Aenderungen an bestehender Choice-Logik

Zweck: Sichere Aenderungen an bestehender Choice-Logik — Flows, Status, Berechtigungen, Queries.

## Workflow

1. **Erkunder** — Spawne `erkunder` Agent fuer die betroffene Logik:
   - Welche Dateien sind betroffen?
   - Welche Flows nutzen den geaenderten Code?
   - Gibt es Seiteneffekte auf andere Endpunkte/Services?
2. **Auswirkungsanalyse:**
   - Statusuebergaenge betroffen? → Statusmaschine in `choiceService.js` pruefen
   - DB-Schema betroffen? → Neue Migration noetig?
   - Auth/Berechtigungen betroffen? → Middleware-Kette pruefen
   - Public-Flow betroffen? → Token/Cookie-Logik pruefen
   - Frontend betroffen? → Welche Seiten/Komponenten anpassen?
3. **Implementierung** — Backend vor Frontend, eine logische Aenderung pro Commit
4. **Tests anpassen** — Bestehende Tests aktualisieren, neue Edge Cases ergaenzen
5. **Modulwaechter** — Spawne `modulwaechter` Agent
6. **Pruefer** — Spawne `pruefer` Agent

## Regeln

- Nie Logik aendern ohne vorher den bestehenden Flow vollstaendig gelesen zu haben
- Bei Statusaenderungen: alle Uebergaenge pruefen, nicht nur den geaenderten
- Bei Query-Aenderungen: Performance und Index-Nutzung pruefen
- Bei Public-Aenderungen: Rate-Limiting und Token-Validierung re-pruefen
