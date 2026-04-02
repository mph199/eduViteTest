# /choice-crud

> Referenz: `docs/planning/choice-module-plan.md`

**Trigger:** "Erstelle CRUD fuer X im Choice-Modul" oder "Neue Ressource X"

Zweck: Scaffoldet Standard-CRUD fuer eine Choice-Ressource, aber nur nach Pruefung ob Standard-CRUD passt.

## Workflow

1. **Guard — Ist Standard-CRUD angemessen?**
   - Pruefe: Gibt es schon ein aehnliches Pattern im Choice-Modul?
   - Pruefe: Ist die Ressource wirklich einfaches CRUD oder hat sie Speziallogik (Statusmaschine, Validierungsketten)?
   - Pruefe: Braucht es wirklich alle 6 Dateien oder nur eine Teilmenge?
   - Pruefe: Gehoert die Route in `admin.js` oder an anderer Stelle (z.B. `public.js`)?
   - Falls KEIN Standard-CRUD: abbrechen, stattdessen `/choice-change` empfehlen
2. **Zod-Schema** — In `backend/schemas/choice.js` ergaenzen (Create + Update Variante)
3. **Service-Methode** — In `backend/modules/choice/services/choiceService.js`: list, getById, create, update, deactivate
4. **Route** — In `backend/modules/choice/routes/admin.js` (oder `public.js`): GET list, GET :id, POST, PUT :id, POST :id/deactivate
5. **Kysely-Types** — `backend/db/types.ts` pruefen/ergaenzen
6. **Frontend-Type** — In `src/types/index.ts` ergaenzen
7. **API-Client** — In `src/services/api.ts` ergaenzen (mit `credentials: 'include'`)

## Regeln

- KEIN Hard Delete — immer `is_active` / deactivate
- Alle Queries ueber Kysely, explizite Spalten, kein `SELECT *`
- Auth: `requireModuleAdmin('choice')` fuer Admin-Routen
- Response normalisieren zu Array vor `.map()` im Frontend
- Nach Scaffolding: modulwaechter spawnen
