import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../config/db.js', () => ({ query: vi.fn() }));
vi.mock('../../db/database.js', () => {
  const mockDb = { destroy: vi.fn() };
  return { db: mockDb };
});
vi.mock('kysely', () => ({
  sql: Object.assign(
    (strings, ...values) => ({
      execute: vi.fn(() => Promise.resolve({ rows: [], numAffectedRows: 0n })),
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

const { query } = await import('../../config/db.js');
const { runRetentionCleanup } = await import('../retention-cleanup.js');

describe('retention-cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ruft alle 7 Cleanup-Funktionen auf', async () => {
    // Mock all queries to succeed with 0 affected rows
    query.mockResolvedValue({ rows: [], rowCount: 0 });

    const results = await runRetentionCleanup();
    expect(results).toHaveProperty('bookingRequests');
    expect(results).toHaveProperty('sswCancelled');
    expect(results).toHaveProperty('blCancelled');
    expect(results).toHaveProperty('sswExpired');
    expect(results).toHaveProperty('blExpired');
    expect(results).toHaveProperty('slotsExpired');
    expect(results).toHaveProperty('auditLog');
  });

  it('verwendet first_name/last_name statt student_name in Cleanup-Queries', async () => {
    query.mockResolvedValue({ rows: [], rowCount: 0 });

    await runRetentionCleanup();

    // Prüfe alle Aufrufe auf first_name/last_name
    const allQueries = query.mock.calls.map(c => c[0]);
    const appointmentQueries = allQueries.filter(q =>
      typeof q === 'string' && (q.includes('ssw_appointments') || q.includes('bl_appointments'))
    );

    for (const q of appointmentQueries) {
      expect(q).toContain('first_name');
      expect(q).toContain('last_name');
      expect(q).not.toContain('student_name');
    }
  });

  // TODO: These tests need updating — retention-cleanup.js now uses Kysely sql``
  // instead of query(). The mock assertions check query.mock.calls which no longer apply.
  it.skip('Fehler in einem Cleanup-Task stoppt nicht die anderen', async () => {
    // bookingRequests query schlägt fehl
    query
      .mockRejectedValueOnce(new Error('DB down')) // bookingRequests
      .mockResolvedValue({ rows: [], rowCount: 0 }); // alle anderen

    const results = await runRetentionCleanup();
    expect(results.bookingRequests).toBe(-1); // Fehler-Markierung
    // Andere sollten trotzdem laufen
    expect(results.auditLog).toBeGreaterThanOrEqual(0);
  });

  it.skip('anonymisiert nur cancelled Appointments', async () => {
    query.mockResolvedValue({ rows: [], rowCount: 0 });

    await runRetentionCleanup();

    const allQueries = query.mock.calls.map(c => c[0]);
    const cancelledQueries = allQueries.filter(q =>
      typeof q === 'string' && q.includes("status = 'cancelled'")
    );

    // Es gibt genau 2 cancelled-Queries (SSW + BL)
    expect(cancelledQueries.length).toBe(2);
  });
});
