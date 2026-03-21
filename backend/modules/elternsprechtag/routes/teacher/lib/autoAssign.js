import { query } from '../../../../../config/db.js';
import logger from '../../../../../config/logger.js';
import { assignRequestToSlot } from './slotAssignment.js';

export async function autoAssignOverdueRequestsForTeacher(teacherId) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Pre-check: skip entirely if this teacher has no free slots
  const { rows: freeCheck } = await query(
    'SELECT 1 FROM slots WHERE teacher_id = $1 AND booked = false LIMIT 1',
    [teacherId]
  );
  if (freeCheck.length === 0) return;

  const { rows: overdueRequests } = await query(
    `SELECT * FROM booking_requests
     WHERE teacher_id = $1 AND status = 'requested' AND verified_at IS NOT NULL AND created_at <= $2
     ORDER BY created_at ASC LIMIT 200`,
    [teacherId, cutoff]
  );

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
  const { rows: overdueRequests } = await query(
    `SELECT * FROM booking_requests
     WHERE status = 'requested' AND verified_at IS NOT NULL AND created_at <= $1
     ORDER BY teacher_id, created_at ASC LIMIT 500`,
    [cutoff]
  );

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

  const { rows: teachersWithSlots } = await query(
    `SELECT DISTINCT teacher_id FROM slots
     WHERE teacher_id = ANY($1) AND booked = false`,
    [teacherIds]
  );
  const hasSlots = new Set(teachersWithSlots.map((r) => r.teacher_id));

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
