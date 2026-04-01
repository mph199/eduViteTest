---
paths:
  - "backend/**/*.js"
  - "backend/**/*.ts"
---

# Backend-Konventionen

- Node.js ESM (`import`/`export`), kein CommonJS (`require`)
- Jede Route braucht passende Auth-Middleware (`requireAuth`, `requireAdmin`, `requireSuperadmin`, `requireModuleAccess`, `requireModuleAdmin`)
- Oeffentliche Endpunkte brauchen Rate Limiting
- `try/catch` um alle DB-Operationen, Fehler als JSON: `res.status(500).json({ error: '...' })`
- Migrationen: `IF NOT EXISTS`, `TIMESTAMPTZ`, naechste Nummer in `backend/migrations/` pruefen
- Module exportieren `register(app, { rateLimiters })` in `backend/modules/<name>/index.js`

## DB-Queries: Kysely (bevorzugt)

Neue Queries MUESSEN Kysely verwenden:

```js
import { db } from '../db/database.js';

// Select (type-safe, kein SELECT *)
const users = await db.selectFrom('users')
  .select(['id', 'username', 'role'])
  .where('id', '=', userId)
  .execute();

// Insert
await db.insertInto('events')
  .values({ name, school_year, starts_at, ends_at })
  .returning('id')
  .executeTakeFirst();

// Update
await db.updateTable('users')
  .set({ role: 'admin' })
  .where('id', '=', userId)
  .execute();

// Transaction
await db.transaction().execute(async (trx) => {
  await trx.insertInto('teachers').values({ ... }).execute();
  await trx.insertInto('users').values({ ... }).execute();
});
```

Regeln:
- KEIN `SELECT *` — immer explizite Spalten (verhindert password_hash Leaks)
- KEIN `query('...')` fuer neue Code-Stellen — nur Kysely
- Bestehende `query()`-Aufrufe werden sukzessive auf Kysely migriert
- Types in `backend/db/types.ts` aktuell halten bei Schema-Aenderungen
