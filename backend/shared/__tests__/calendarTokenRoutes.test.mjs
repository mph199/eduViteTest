import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

// Mock dependencies
vi.mock('../../config/db.js', () => ({ query: vi.fn() }));
vi.mock('../../config/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock('../tokenUtils.js', () => ({
  getExpiresAt: vi.fn((d) => {
    const date = new Date(d);
    date.setMonth(date.getMonth() + 12);
    return date;
  }),
}));
vi.mock('../sqlGuards.js', () => ({
  assertSafeIdentifier: vi.fn(),
}));

const { query } = await import('../../config/db.js');
const { createCalendarTokenRoutes } = await import('../calendarTokenRoutes.js');

// Simple test helper: create express app with the router
function createApp() {
  const resolveCounselorId = vi.fn();
  const router = createCalendarTokenRoutes({
    table: 'bl_counselors',
    logPrefix: 'BL',
    resolveCounselorId,
  });

  const app = express();
  app.use(express.json());
  // Simulate authenticated user
  app.use((req, _res, next) => { req.user = { id: 1 }; next(); });
  app.use('/', router);
  return { app, resolveCounselorId };
}

// Simple request helper (no supertest dependency)
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

describe('calendarTokenRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /calendar-token', () => {
    it('gibt { exists: false } wenn kein Token vorhanden', async () => {
      const { app, resolveCounselorId } = createApp();
      resolveCounselorId.mockResolvedValue(42);
      query.mockResolvedValue({ rows: [{ has_token: false }] });

      const res = await request(app, 'GET', '/calendar-token');
      expect(res.status).toBe(200);
      expect(res.body.exists).toBe(false);
    });

    it('gibt { exists: true } bei gültigem Token', async () => {
      const { app, resolveCounselorId } = createApp();
      resolveCounselorId.mockResolvedValue(42);
      const createdAt = new Date().toISOString();
      query.mockResolvedValue({
        rows: [{ has_token: true, calendar_token_created_at: createdAt }],
      });

      const res = await request(app, 'GET', '/calendar-token');
      expect(res.status).toBe(200);
      expect(res.body.exists).toBe(true);
      expect(res.body.isExpired).toBe(false);
    });

    it('gibt 403 wenn resolveCounselorId null zurückgibt', async () => {
      const { app, resolveCounselorId } = createApp();
      resolveCounselorId.mockResolvedValue(null);

      const res = await request(app, 'GET', '/calendar-token');
      expect(res.status).toBe(403);
    });
  });

  describe('POST /calendar-token', () => {
    it('erstellt Token erfolgreich', async () => {
      const { app, resolveCounselorId } = createApp();
      resolveCounselorId.mockResolvedValue(42);
      query
        .mockResolvedValueOnce({ rows: [{ has_token: false }] }) // Check existing
        .mockResolvedValueOnce({ rows: [] }); // UPDATE token

      const res = await request(app, 'POST', '/calendar-token');
      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.token.length).toBe(64); // 32 bytes hex
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.expiresAt).toBeDefined();
    });

    it('gibt 409 bei aktivem Token', async () => {
      const { app, resolveCounselorId } = createApp();
      resolveCounselorId.mockResolvedValue(42);
      query.mockResolvedValue({
        rows: [{ has_token: true, calendar_token_created_at: new Date().toISOString() }],
      });

      const res = await request(app, 'POST', '/calendar-token');
      expect(res.status).toBe(409);
    });
  });

  describe('POST /calendar-token/rotate', () => {
    it('rotiert Token erfolgreich', async () => {
      const { app, resolveCounselorId } = createApp();
      resolveCounselorId.mockResolvedValue(42);
      query.mockResolvedValue({ rows: [] });

      const res = await request(app, 'POST', '/calendar-token/rotate');
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });
  });

  describe('DELETE /calendar-token', () => {
    it('widerruft Token erfolgreich', async () => {
      const { app, resolveCounselorId } = createApp();
      resolveCounselorId.mockResolvedValue(42);
      query.mockResolvedValue({ rows: [] });

      const res = await request(app, 'DELETE', '/calendar-token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('setzt Hash und Timestamp auf NULL', async () => {
      const { app, resolveCounselorId } = createApp();
      resolveCounselorId.mockResolvedValue(42);
      query.mockResolvedValue({ rows: [] });

      await request(app, 'DELETE', '/calendar-token');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('calendar_token_hash = NULL'),
        [42]
      );
    });
  });
});
