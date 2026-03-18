import { query } from '../../../../../config/db.js';
import logger from '../../../../../config/logger.js';
import { assignRequestToSlot } from './slotAssignment.js';

export async function autoAssignOverdueRequestsForTeacher(teacherId) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { rows: overdueRequests } = await query(
    `SELECT * FROM booking_requests
     WHERE teacher_id = $1 AND status = 'requested' AND verified_at IS NOT NULL AND created_at <= $2
     ORDER BY created_at ASC LIMIT 200`,
    [teacherId, cutoff]
  );

  for (const reqRow of overdueRequests || []) {
    try {
      await assignRequestToSlot(reqRow, teacherId, null);
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
     ORDER BY created_at ASC LIMIT 500`,
    [cutoff]
  );

  for (const reqRow of overdueRequests || []) {
    try {
      await assignRequestToSlot(reqRow, reqRow.teacher_id, null);
    } catch (e) {
      logger.warn({ err: e }, 'Global auto-assignment failed');
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
