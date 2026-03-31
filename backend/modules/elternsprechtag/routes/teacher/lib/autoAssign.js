import { sql } from 'kysely';
import { db } from '../../../../../db/database.js';
import logger from '../../../../../config/logger.js';
import { assignRequestToSlot } from './slotAssignment.js';

export async function autoAssignOverdueRequestsForTeacher(teacherId) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Pre-check: skip entirely if this teacher has no free slots
  const freeCheck = await db.selectFrom('slots')
    .select(sql`1`.as('exists'))
    .where('teacher_id', '=', teacherId)
    .where('booked', '=', false)
    .limit(1)
    .execute();
  if (freeCheck.length === 0) return;

  const overdueRequests = await db.selectFrom('booking_requests')
    .selectAll()
    .where('teacher_id', '=', teacherId)
    .where('status', '=', 'requested')
    .where('verified_at', 'is not', null)
    .where('created_at', '<=', cutoff)
    .orderBy('created_at', 'asc')
    .limit(200)
    .execute();

  for (const reqRow of overdueRequests || []) {
    try {
      const result = await assignRequestToSlot(reqRow, teacherId, null);
      // Stop early if no more free slots for this teacher
      if (!result.ok && result.code === 'NO_SLOT_AVAILABLE') break;
    } catch (e) {
      logger.warn({ err: e }, 'Auto-assignment for overdue request failed');
    }
  }
}

async function autoAssignOverdueRequestsGlobal() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const overdueRequests = await db.selectFrom('booking_requests')
    .selectAll()
    .where('status', '=', 'requested')
    .where('verified_at', 'is not', null)
    .where('created_at', '<=', cutoff)
    .orderBy('teacher_id')
    .orderBy('created_at', 'asc')
    .limit(500)
    .execute();

  // Group by teacher to enable early-exit per teacher
  const byTeacher = new Map();
  for (const req of overdueRequests || []) {
    const tid = req.teacher_id;
    if (!byTeacher.has(tid)) byTeacher.set(tid, []);
    byTeacher.get(tid).push(req);
  }

  // Pre-check which teachers have free slots (single query)
  const teacherIds = [...byTeacher.keys()];
  if (teacherIds.length === 0) return;

  const teachersWithSlots = await sql`
    SELECT DISTINCT teacher_id FROM slots
    WHERE teacher_id = ANY(${teacherIds}) AND booked = false
  `.execute(db);
  const hasSlots = new Set((teachersWithSlots.rows || []).map((r) => r.teacher_id));

  for (const [teacherId, requests] of byTeacher) {
    if (!hasSlots.has(teacherId)) continue; // Skip teachers without free slots

    for (const reqRow of requests) {
      try {
        const result = await assignRequestToSlot(reqRow, teacherId, null);
        if (!result.ok && result.code === 'NO_SLOT_AVAILABLE') break;
      } catch (e) {
        logger.warn({ err: e }, 'Global auto-assignment failed');
      }
    }
  }
}

// Start global auto-assign sweep every 5 minutes
const autoAssignIntervalMs = 5 * 60 * 1000;
const autoAssignTimer = setInterval(() => {
  autoAssignOverdueRequestsGlobal().catch((e) => {
    logger.warn({ err: e }, 'Auto-assignment sweep failed');
  });
}, autoAssignIntervalMs);

if (typeof autoAssignTimer.unref === 'function') {
  autoAssignTimer.unref();
}
