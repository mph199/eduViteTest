import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

// Mock dependencies
vi.mock('../../config/db.js', () => ({ query: vi.fn() }));
vi.mock('../../config/rateLimiter.js', () => ({
  createRateLimiter: () => (_req, _res, next) => next(),
}));
vi.mock('../../config/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../middleware/validate.js', () => ({
  validate: () => (req, _res, next) => {
    // Simple passthrough — real Zod validation tested separately
    next();
  },
}));
vi.mock('../../schemas/booking.js', () => ({
  consentWithdrawSchema: {},
}));

const { query } = await import('../../config/db.js');
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
  });

  it('anonymisiert bl_appointments mit first_name/last_name', async () => {
    const app = createApp();
    query.mockResolvedValue({ rowCount: 2 });

    const res = await request(app, 'POST', '/withdraw', {
      email: 'test@example.com',
      module: 'beratungslehrer',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Prüfe dass UPDATE first_name/last_name verwendet (nicht student_name)
    const updateCall = query.mock.calls.find(c =>
      typeof c[0] === 'string' && c[0].includes('bl_appointments')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall[0]).toContain('first_name = NULL');
    expect(updateCall[0]).toContain('last_name = NULL');
    expect(updateCall[0]).not.toContain('student_name');
  });

  it('anonymisiert ssw_appointments mit first_name/last_name', async () => {
    const app = createApp();
    query.mockResolvedValue({ rowCount: 1 });

    const res = await request(app, 'POST', '/withdraw', {
      email: 'test@example.com',
      module: 'schulsozialarbeit',
    });

    expect(res.status).toBe(200);
    const updateCall = query.mock.calls.find(c =>
      typeof c[0] === 'string' && c[0].includes('ssw_appointments')
    );
    expect(updateCall[0]).toContain('first_name = NULL');
    expect(updateCall[0]).toContain('last_name = NULL');
  });

  it('gibt immer gleiche Antwort (kein Leak ob E-Mail existiert)', async () => {
    const app = createApp();
    query.mockResolvedValue({ rowCount: 0 }); // Keine Daten gefunden

    const res = await request(app, 'POST', '/withdraw', {
      email: 'unknown@example.com',
      module: 'beratungslehrer',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Widerruf verarbeitet');
  });

  it('schreibt Consent-Receipt nur bei anonymizedCount > 0', async () => {
    const app = createApp();
    query.mockResolvedValue({ rowCount: 0 });

    await request(app, 'POST', '/withdraw', {
      email: 'unknown@example.com',
      module: 'beratungslehrer',
    });

    const insertCalls = query.mock.calls.filter(c =>
      typeof c[0] === 'string' && c[0].includes('consent_receipts')
    );
    expect(insertCalls.length).toBe(0);
  });

  it('schreibt Consent-Receipt bei erfolgreicher Anonymisierung', async () => {
    const app = createApp();
    query.mockResolvedValue({ rowCount: 3 });

    await request(app, 'POST', '/withdraw', {
      email: 'test@example.com',
      module: 'beratungslehrer',
    });

    const insertCalls = query.mock.calls.filter(c =>
      typeof c[0] === 'string' && c[0].includes('consent_receipts')
    );
    expect(insertCalls.length).toBe(1);
    expect(insertCalls[0][1]).toContain('beratungslehrer');
  });
});
