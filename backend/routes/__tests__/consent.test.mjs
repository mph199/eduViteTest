import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

// ── Chainable mock builder for Kysely ────────────────────────────────
function createChainMock(result = {}) {
  const chain = {};
  for (const method of ['selectFrom', 'updateTable', 'insertInto', 'deleteFrom',
    'set', 'where', 'select', 'values', 'onConflict', 'doNothing',
    'returning', 'returningAll', 'orderBy', 'limit']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.execute = vi.fn(() => Promise.resolve(result));
  chain.executeTakeFirst = vi.fn(() => Promise.resolve(result));
  chain.executeTakeFirstOrThrow = vi.fn(() => Promise.resolve(result));
  return chain;
}

let mockDbChain;
let mockInsertChain;

vi.mock('../../config/db.js', () => ({ query: vi.fn() }));
vi.mock('../../db/database.js', () => {
  mockDbChain = createChainMock({ numUpdatedRows: 0n });
  mockInsertChain = createChainMock();
  return {
    db: {
      updateTable: vi.fn(() => mockDbChain),
      insertInto: vi.fn(() => mockInsertChain),
      selectFrom: vi.fn(() => mockDbChain),
    },
  };
});
vi.mock('kysely', () => ({
  sql: Object.assign(
    (strings, ...values) => ({
      execute: vi.fn(() => Promise.resolve({ rows: [{ affected: 0 }] })),
    }),
    { raw: vi.fn(), table: vi.fn(), ref: vi.fn() }
  ),
}));
vi.mock('../../config/rateLimiter.js', () => ({
  createRateLimiter: () => (_req, _res, next) => next(),
}));
vi.mock('../../config/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../middleware/validate.js', () => ({
  validate: () => (req, _res, next) => next(),
}));
vi.mock('../../schemas/booking.js', () => ({
  consentWithdrawSchema: {},
}));

const { db } = await import('../../db/database.js');
const { default: consentRouter } = await import('../consent.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/', consentRouter);
  return app;
}

async function request(app, method, path, body) {
  return new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      const opts = {
        method: method.toUpperCase(),
        headers: { 'Content-Type': 'application/json' },
      };
      if (body) opts.body = JSON.stringify(body);
      try {
        const res = await fetch(`http://127.0.0.1:${port}${path}`, opts);
        const json = await res.json().catch(() => null);
        resolve({ status: res.status, body: json });
      } finally {
        server.close();
      }
    });
  });
}

describe('consent withdraw (Art. 7 DSGVO)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: updateTable returns 0 affected rows
    mockDbChain.executeTakeFirst.mockResolvedValue({ numUpdatedRows: 0n });
    mockInsertChain.execute.mockResolvedValue(undefined);
  });

  it('anonymisiert bl_appointments — calls db.updateTable(bl_appointments)', async () => {
    mockDbChain.executeTakeFirst.mockResolvedValue({ numUpdatedRows: 2n });
    const app = createApp();

    const res = await request(app, 'POST', '/withdraw', {
      email: 'test@example.com',
      module: 'beratungslehrer',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(db.updateTable).toHaveBeenCalledWith('bl_appointments');
  });

  it('anonymisiert ssw_appointments — calls db.updateTable(ssw_appointments)', async () => {
    mockDbChain.executeTakeFirst.mockResolvedValue({ numUpdatedRows: 1n });
    const app = createApp();

    const res = await request(app, 'POST', '/withdraw', {
      email: 'test@example.com',
      module: 'schulsozialarbeit',
    });

    expect(res.status).toBe(200);
    expect(db.updateTable).toHaveBeenCalledWith('ssw_appointments');
  });

  it('gibt immer gleiche Antwort (kein Leak ob E-Mail existiert)', async () => {
    const app = createApp();

    const res = await request(app, 'POST', '/withdraw', {
      email: 'unknown@example.com',
      module: 'beratungslehrer',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Widerruf verarbeitet');
  });

  it('schreibt Consent-Receipt nur bei anonymizedCount > 0', async () => {
    mockDbChain.executeTakeFirst.mockResolvedValue({ numUpdatedRows: 0n });
    const app = createApp();

    await request(app, 'POST', '/withdraw', {
      email: 'unknown@example.com',
      module: 'beratungslehrer',
    });

    // No insertInto call when 0 rows affected
    expect(db.insertInto).not.toHaveBeenCalled();
  });

  it('schreibt Consent-Receipt bei erfolgreicher Anonymisierung', async () => {
    mockDbChain.executeTakeFirst.mockResolvedValue({ numUpdatedRows: 3n });
    const app = createApp();

    await request(app, 'POST', '/withdraw', {
      email: 'test@example.com',
      module: 'beratungslehrer',
    });

    expect(db.insertInto).toHaveBeenCalledWith('consent_receipts');
  });
});
