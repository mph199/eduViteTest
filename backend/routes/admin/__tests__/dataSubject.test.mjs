import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

// Mock dependencies
vi.mock('../../../config/db.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
}));
vi.mock('../../../db/database.js', () => {
  const chain = {};
  for (const m of ['selectFrom','updateTable','insertInto','deleteFrom','set','where','select',
    'values','onConflict','doNothing','returning','returningAll','orderBy','limit']) {
    chain[m] = vi.fn(() => chain);
  }
  chain.execute = vi.fn(() => Promise.resolve([]));
  chain.executeTakeFirst = vi.fn(() => Promise.resolve(null));
  chain.executeTakeFirstOrThrow = vi.fn(() => Promise.resolve({}));
  return { db: { selectFrom: vi.fn(() => chain), updateTable: vi.fn(() => chain), insertInto: vi.fn(() => chain), deleteFrom: vi.fn(() => chain), transaction: vi.fn(() => ({ execute: vi.fn(fn => fn(chain)) })) } };
});
vi.mock('kysely', () => ({
  sql: Object.assign(
    (strings, ...values) => ({ execute: vi.fn(() => Promise.resolve({ rows: [], numAffectedRows: 0n })) }),
    { raw: vi.fn(), table: vi.fn(), ref: vi.fn(), join: vi.fn(() => ({})) }
  ),
}));
vi.mock('../../../config/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
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

const { query, getClient } = await import('../../../config/db.js');
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

describe('dataSubject (DSGVO Art. 15/16/17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /data-subject/search (Art. 15)', () => {
    it('sucht mit first_name/last_name in bl/ssw_appointments', async () => {
      const app = createApp();
      query.mockResolvedValue({ rows: [] });

      await request(app, 'GET', '/data-subject/search?email=test@example.com');

      const allQueries = query.mock.calls.map(c => c[0]);
      const blQuery = allQueries.find(q => typeof q === 'string' && q.includes('bl_appointments'));
      const sswQuery = allQueries.find(q => typeof q === 'string' && q.includes('ssw_appointments'));

      expect(blQuery).toContain('first_name');
      expect(blQuery).toContain('last_name');
      expect(blQuery).not.toContain('student_name');
      expect(sswQuery).toContain('first_name');
      expect(sswQuery).toContain('last_name');
      expect(sswQuery).not.toContain('student_name');
    });

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
  });

  describe('DELETE /data-subject (Art. 17)', () => {
    it('anonymisiert mit first_name/last_name statt student_name', async () => {
      const app = createApp();
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };
      getClient.mockResolvedValue(mockClient);
      query.mockResolvedValue({ rows: [] }); // for writeAuditLog

      await request(app, 'DELETE', '/data-subject?email=test@example.com');

      const allQueries = mockClient.query.mock.calls.map(c => c[0]);

      // SSW anonymize query
      const sswAnonymize = allQueries.find(q =>
        typeof q === 'string' && q.includes('ssw_appointments') && q.includes('UPDATE')
      );
      expect(sswAnonymize).toContain('first_name = NULL');
      expect(sswAnonymize).toContain('last_name = NULL');
      expect(sswAnonymize).not.toContain('student_name');

      // BL anonymize query
      const blAnonymize = allQueries.find(q =>
        typeof q === 'string' && q.includes('bl_appointments') && q.includes('UPDATE')
      );
      expect(blAnonymize).toContain('first_name = NULL');
      expect(blAnonymize).toContain('last_name = NULL');
      expect(blAnonymize).not.toContain('student_name');
    });

    it('verwendet Transaktionen (BEGIN/COMMIT)', async () => {
      const app = createApp();
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      await request(app, 'DELETE', '/data-subject?email=test@example.com');

      const allQueries = mockClient.query.mock.calls.map(c => c[0]);
      expect(allQueries[0]).toBe('BEGIN');
      expect(allQueries[allQueries.length - 1]).toBe('COMMIT');
    });

    it('rollt bei Fehler zurück', async () => {
      const app = createApp();
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({ rows: [{ affected: 0 }] }) // anonymize_booking_requests
          .mockRejectedValueOnce(new Error('DB error')), // slots UPDATE fails
        release: vi.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const res = await request(app, 'DELETE', '/data-subject?email=test@example.com');
      expect(res.status).toBe(500);

      const allQueries = mockClient.query.mock.calls.map(c => c[0]);
      expect(allQueries).toContain('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('PATCH /data-subject (Art. 16)', () => {
    it('erlaubt first_name/last_name als korrigierbare Felder für bl/ssw_appointments', async () => {
      const app = createApp();
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      await request(app, 'PATCH', '/data-subject?email=test@example.com', {
        corrections: { first_name: 'Neuer Vorname' },
      });

      const allQueries = mockClient.query.mock.calls.map(c => c[0]);
      const updateQueries = allQueries.filter(q =>
        typeof q === 'string' && q.includes('UPDATE') && q.includes('first_name')
      );
      // Sollte Updates auf ssw_appointments und bl_appointments enthalten
      expect(updateQueries.length).toBeGreaterThanOrEqual(1);
    });

    it('blockiert student_name als Korrekturfeld für bl/ssw_appointments', async () => {
      const app = createApp();
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      await request(app, 'PATCH', '/data-subject?email=test@example.com', {
        corrections: { student_name: 'Should Not Work' },
      });

      const allQueries = mockClient.query.mock.calls.map(c => c[0]);
      // student_name sollte NUR für booking_requests und slots funktionieren (dort existiert es noch)
      // Aber NICHT für bl_appointments oder ssw_appointments
      const blSswUpdates = allQueries.filter(q =>
        typeof q === 'string' &&
        q.includes('UPDATE') &&
        (q.includes('bl_appointments') || q.includes('ssw_appointments')) &&
        q.includes('student_name')
      );
      expect(blSswUpdates.length).toBe(0);
    });
  });
});
