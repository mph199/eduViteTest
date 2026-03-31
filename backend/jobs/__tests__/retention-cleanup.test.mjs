import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track all sql``.execute() calls
const sqlExecuteMock = vi.fn(() => Promise.resolve({ rows: [], numAffectedRows: 0n }));

vi.mock('../../config/db.js', () => ({ query: vi.fn() }));
vi.mock('../../db/database.js', () => {
  return { db: {} };
});
vi.mock('kysely', () => ({
  sql: Object.assign(
    (strings, ...values) => ({
      execute: sqlExecuteMock,
    }),
    { raw: vi.fn(), table: vi.fn(), ref: vi.fn() }
  ),
}));
vi.mock('../../config/retention.js', () => ({
  default: {
    bookingRequestsDays: 90,
    cancelledDays: 14,
    sswAppointmentsDays: 365,
    blAppointmentsDays: 365,
    auditLogDays: 730,
    flowAktivitaetDays: 730,
  },
}));
vi.mock('../../config/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const { runRetentionCleanup } = await import('../retention-cleanup.js');

describe('retention-cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlExecuteMock.mockResolvedValue({ rows: [], numAffectedRows: 0n });
  });

  it('ruft alle 8 Cleanup-Funktionen auf (inkl. flowAktivitaet)', async () => {
    const results = await runRetentionCleanup();
    expect(results).toHaveProperty('bookingRequests');
    expect(results).toHaveProperty('sswCancelled');
    expect(results).toHaveProperty('blCancelled');
    expect(results).toHaveProperty('sswExpired');
    expect(results).toHaveProperty('blExpired');
    expect(results).toHaveProperty('slotsExpired');
    expect(results).toHaveProperty('auditLog');
    expect(results).toHaveProperty('flowAktivitaet');
  });

  it('Fehler in einem Cleanup-Task stoppt nicht die anderen', async () => {
    // First call (bookingRequests) fails, rest succeeds
    sqlExecuteMock
      .mockRejectedValueOnce(new Error('DB down'))
      .mockResolvedValue({ rows: [], numAffectedRows: 0n });

    const results = await runRetentionCleanup();
    expect(results.bookingRequests).toBe(-1); // Error marker
    // Others should still run
    expect(results.auditLog).toBeGreaterThanOrEqual(0);
  });

  it('gibt Anzahl betroffener Zeilen zurück', async () => {
    sqlExecuteMock.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }], numAffectedRows: 2n });

    const results = await runRetentionCleanup();
    // All functions should return >= 0
    for (const [key, val] of Object.entries(results)) {
      expect(val).toBeGreaterThanOrEqual(0);
    }
  });
});
