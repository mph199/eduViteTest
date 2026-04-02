# /choice-test

> Referenz: `docs/planning/choice-module-plan.md`

**Trigger:** "Teste Endpoint X" oder "Tests fuer Choice-Route X"

Zweck: Generiert strategisch fundierte Tests fuer einen Choice-Endpoint, basierend auf bestehenden Testmustern.

## Workflow

1. **Endpoint analysieren** — Route, Middleware, Service-Logik, Validierung, DB-Operationen lesen
2. **Bestehende Testmuster suchen** — Grep in `backend/modules/*/tests/`, `backend/__tests__/`, `src/**/*.test.*` nach aehnlichen Patterns
3. **Teststrategie ableiten:**
   - Braucht es Mocking oder DB-nahe Tests?
   - Welche Fixtures/Setup-Daten sind noetig?
   - Welche Edge Cases sind fachlich relevant?
4. **Tests implementieren** (Vitest + Supertest):
   - **Happy Path** — Erfolgreicher Request mit gueltigem Input
   - **Validierungsfehler** — Fehlende/ungueltige Felder (Zod-Rejection)
   - **Auth/Permission** — Ohne Token, falsches Token, falsche Rolle
   - **Not Found** — Unbekannte ID
   - **Fachliche Konflikte** — z.B. Submit bei geschlossener Group, doppelte Prioritaet, inaktive Option
5. **Konsistenz pruefen** — Testdatei-Struktur und Naming muss zu bestehenden Tests passen

## Regeln

- Bestehende Tests im Modul als Vorlage priorisieren, nicht generisch scaffolden
- Keine Tests fuer triviale Getter ohne Logik
- Bei Public-Endpoints: Token/Cookie-Flow mittesten
- Bei Submissions: min/max/ranking-Validierung mittesten
