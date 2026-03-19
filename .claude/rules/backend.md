---
paths:
  - "backend/**/*.js"
---

# Backend-Konventionen

- Node.js ESM (`import`/`export`), kein CommonJS (`require`)
- Alle DB-Queries parametrisiert: `query('SELECT * FROM t WHERE id = $1', [id])`
- Jede Route braucht passende Auth-Middleware (`requireAuth`, `requireAdmin`, `requireTeacher`, `requireSuperadmin`, `requireSSW`)
- Oeffentliche Endpunkte brauchen Rate Limiting
- `try/catch` um alle DB-Operationen, Fehler als JSON: `res.status(500).json({ error: '...' })`
- Migrationen: `IF NOT EXISTS`, `TIMESTAMPTZ`, naechste Nummer in `backend/migrations/` pruefen
- Module exportieren `register(app, { rateLimiters })` in `backend/modules/<name>/index.js`
