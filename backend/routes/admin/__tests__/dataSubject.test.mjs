import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

// Chainable Kysely mock
const sqlExecuteMock = vi.fn(() => Promise.resolve({ rows: [], numAffectedRows: 0n }));

function createChain() {
  const chain = {};
  for (const m of ['selectFrom','updateTable','insertInto','deleteFrom','set','where','select',
    'values','onConflict','doNothing','returning','returningAll','orderBy','limit','offset']) {
    chain[m] = vi.fn(() => chain);
  }
  chain.execute = vi.fn(() => Promise.resolve([]));
  chain.executeTakeFirst = vi.fn(() => Promise.resolve(null));
  chain.executeTakeFirstOrThrow = vi.fn(() => Promise.resolve({}));
  return chain;
}

const dbChain = createChain();
const trxChain = createChain();

vi.mock('../../../config/db.js', () => ({ query: vi.fn(), getClient: vi.fn() }));
vi.mock('../../../db/database.js', () => ({
  db: {
    selectFrom: vi.fn(() => dbChain),
    updateTable: vi.fn(() => dbChain),
    insertInto: vi.fn(() => dbChain),
    deleteFrom: vi.fn(() => dbChain),
    transaction: vi.fn(() => ({ execute: vi.fn((fn) => fn(trxChain)) })),
  },
}));
vi.mock('kysely', () => ({
  sql: Object.assign(
    (strings, ...values) => ({ execute: sqlExecuteMock }),
    { raw: vi.fn(), table: vi.fn((t) => t), ref: vi.fn((r) => r), join: vi.fn(() => ({})) }
  ),
}));
vi.mock('../../../config/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../middleware/auth.js', () => ({
  requireSuperadmin: (_req, _res, next) => next(),
}));
vi.mock('../../../middleware/audit-log.js', () => ({
  writeAuditLog: vi.fn(),
}));
vi.mock('../../../shared/sqlGuards.js', () => ({
  assertSafeIdentifier: vi.fn(),
}));
vi.mock('../../../utils/validators.js', () => ({
  EMAIL_RE: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
}));

const { db } = await import('../../../db/database.js');
const { default: dataSubjectRouter } = await import('../dataSubject.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 1, role: 'superadmin' };
    next();
  });
  app.use('/', dataSubjectRouter);
  return app;
}

async function request(app, method, path, body) {
  return new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      const opts = { method: method.toUpperCase(), headers: { 'Content-Type': 'application/json' } };
      if (body) opts.body = JSON.stringify(body);
      try {
        const res = await fetch(`http://127.0.0.1:${port}${path}`, opts);
        const json = await res.json().catch(() => null);
        resolve({ status: res.status, body: json });
      } finally { server.close(); }
    });
  });
}

describe('dataSubject (DSGVO Art. 15/16/17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain.execute.mockResolvedValue([]);
    dbChain.executeTakeFirst.mockResolvedValue(null);
    trxChain.execute.mockResolvedValue([]);
    trxChain.executeTakeFirst.mockResolvedValue(null);
    sqlExecuteMock.mockResolvedValue({ rows: [], numAffectedRows: 0n });
  });

  describe('GET /data-subject/search (Art. 15)', () => {
    it('gibt 400 bei fehlender E-Mail', async () => {
      const app = createApp();
      const res = await request(app, 'GET', '/data-subject/search');
      expect(res.status).toBe(400);
    });

    it('gibt 400 bei ungültiger E-Mail', async () => {
      const app = createApp();
      const res = await request(app, 'GET', '/data-subject/search?email=not-an-email');
      expect(res.status).toBe(400);
    });

    it('gibt 200 mit leeren Ergebnissen bei gültiger E-Mail', async () => {
      const app = createApp();
      const res = await request(app, 'GET', '/data-subject/search?email=test@example.com');
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /data-subject (Art. 17)', () => {
    it('gibt 400 bei fehlender E-Mail', async () => {
      const app = createApp();
      const res = await request(app, 'DELETE', '/data-subject');
      expect(res.status).toBe(400);
    });

    it('verwendet db.transaction für Anonymisierung', async () => {
      const app = createApp();
      await request(app, 'DELETE', '/data-subject?email=test@example.com');
      expect(db.transaction).toHaveBeenCalled();
    });

    it('gibt 200 bei erfolgreicher Anonymisierung', async () => {
      const app = createApp();
      const res = await request(app, 'DELETE', '/data-subject?email=test@example.com');
      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /data-subject (Art. 16)', () => {
    it('gibt 400 bei fehlender E-Mail', async () => {
      const app = createApp();
      const res = await request(app, 'PATCH', '/data-subject', { corrections: {} });
      expect(res.status).toBe(400);
    });

    it('gibt 400 bei fehlenden Korrekturen', async () => {
      const app = createApp();
      const res = await request(app, 'PATCH', '/data-subject?email=test@example.com', {});
      expect(res.status).toBe(400);
    });

    it('gibt 200 bei gültiger Korrektur', async () => {
      const app = createApp();
      const res = await request(app, 'PATCH', '/data-subject?email=test@example.com', {
        corrections: { first_name: 'Neuer Vorname' },
      });
      expect(res.status).toBe(200);
    });
  });
});
