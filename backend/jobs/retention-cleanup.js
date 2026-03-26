/**
 * Retention Cleanup Job
 *
 * Automatically anonymizes PII data that has exceeded its retention period.
 * Runs on a configurable interval (default: daily at startup + every 24h).
 *
 * Covers:
 * - booking_requests: after event is closed for N days
 * - ssw_appointments: cancelled appointments after N days
 * - bl_appointments: cancelled appointments after N days
 * - audit_log: entries older than N days (default: 730 = 24 months)
 */

import { query } from '../config/db.js';
import retention from '../config/retention.js';
import logger from '../config/logger.js';

/**
 * Anonymize booking_requests for events closed longer than retention period.
 * Uses the DB function anonymize_booking_requests() for consistency.
 * Triggers on events.closed_at (not updated_at) for reliable timing.
 */
async function cleanupBookingRequests() {
  const { rows: events } = await query(
    `SELECT id FROM events
     WHERE status = 'closed'
       AND closed_at IS NOT NULL
       AND closed_at < NOW() - MAKE_INTERVAL(days => $1)`,
    [retention.bookingRequestsDays]
  );

  let total = 0;
  for (const event of events) {
    const { rows } = await query(
      'SELECT anonymize_booking_requests($1) AS affected',
      [event.id]
    );
    total += rows[0]?.affected || 0;
  }
  return total;
}

/**
 * Anonymize cancelled SSW appointments older than retention period.
 */
async function cleanupSswAppointments() {
  const { rows } = await query(
    `UPDATE ssw_appointments
     SET first_name = NULL,
         last_name = NULL,
         student_class = NULL,
         email = NULL,
         phone = NULL,
         updated_at = NOW()
     WHERE status = 'cancelled'
       AND updated_at < NOW() - MAKE_INTERVAL(days => $1)
       AND (first_name IS NOT NULL OR last_name IS NOT NULL OR email IS NOT NULL)
     RETURNING id`,
    [retention.cancelledDays]
  );
  return rows.length;
}

/**
 * Anonymize cancelled BL appointments older than retention period.
 */
async function cleanupBlAppointments() {
  const { rows } = await query(
    `UPDATE bl_appointments
     SET first_name = NULL,
         last_name = NULL,
         student_class = NULL,
         email = NULL,
         phone = NULL,
         updated_at = NOW()
     WHERE status = 'cancelled'
       AND updated_at < NOW() - MAKE_INTERVAL(days => $1)
       AND (first_name IS NOT NULL OR last_name IS NOT NULL OR email IS NOT NULL)
     RETURNING id`,
    [retention.cancelledDays]
  );
  return rows.length;
}

/**
 * Anonymize non-cancelled SSW/BL appointments past general retention.
 */
async function cleanupExpiredSswAppointments() {
  const { rows } = await query(
    `UPDATE ssw_appointments
     SET first_name = NULL,
         last_name = NULL,
         student_class = NULL,
         email = NULL,
         phone = NULL,
         updated_at = NOW()
     WHERE date::date < CURRENT_DATE - MAKE_INTERVAL(days => $1)
       AND (first_name IS NOT NULL OR last_name IS NOT NULL OR email IS NOT NULL)
     RETURNING id`,
    [retention.sswAppointmentsDays]
  );
  return rows.length;
}

async function cleanupExpiredBlAppointments() {
  const { rows } = await query(
    `UPDATE bl_appointments
     SET first_name = NULL,
         last_name = NULL,
         student_class = NULL,
         email = NULL,
         phone = NULL,
         updated_at = NOW()
     WHERE date::date < CURRENT_DATE - MAKE_INTERVAL(days => $1)
       AND (first_name IS NOT NULL OR last_name IS NOT NULL OR email IS NOT NULL)
     RETURNING id`,
    [retention.blAppointmentsDays]
  );
  return rows.length;
}

/**
 * Anonymize slots PII for events closed longer than retention period.
 */
async function cleanupExpiredSlots() {
  const { rows } = await query(
    `UPDATE slots s
     SET parent_name = NULL,
         student_name = NULL,
         company_name = NULL,
         trainee_name = NULL,
         representative_name = NULL,
         class_name = NULL,
         email = NULL,
         message = NULL,
         verification_token_hash = NULL,
         updated_at = NOW()
     FROM events e
     WHERE s.event_id = e.id
       AND e.status = 'closed'
       AND e.closed_at IS NOT NULL
       AND e.closed_at < NOW() - MAKE_INTERVAL(days => $1)
       AND (s.parent_name IS NOT NULL OR s.email IS NOT NULL)
     RETURNING s.id`,
    [retention.bookingRequestsDays]
  );
  return rows.length;
}

/**
 * Delete audit_log entries older than retention period.
 */
async function cleanupAuditLog() {
  const { rowCount } = await query(
    `DELETE FROM audit_log
     WHERE created_at < NOW() - MAKE_INTERVAL(days => $1)`,
    [retention.auditLogDays]
  );
  return rowCount;
}

/**
 * Run all cleanup tasks. Returns summary of affected rows.
 */
export async function runRetentionCleanup() {
  const results = {};

  try {
    results.bookingRequests = await cleanupBookingRequests();
  } catch (err) {
    logger.error({ err }, 'Retention cleanup: booking_requests failed');
    results.bookingRequests = -1;
  }

  try {
    results.sswCancelled = await cleanupSswAppointments();
  } catch (err) {
    logger.error({ err }, 'Retention cleanup: ssw_appointments (cancelled) failed');
    results.sswCancelled = -1;
  }

  try {
    results.blCancelled = await cleanupBlAppointments();
  } catch (err) {
    logger.error({ err }, 'Retention cleanup: bl_appointments (cancelled) failed');
    results.blCancelled = -1;
  }

  try {
    results.sswExpired = await cleanupExpiredSswAppointments();
  } catch (err) {
    logger.error({ err }, 'Retention cleanup: ssw_appointments (expired) failed');
    results.sswExpired = -1;
  }

  try {
    results.blExpired = await cleanupExpiredBlAppointments();
  } catch (err) {
    logger.error({ err }, 'Retention cleanup: bl_appointments (expired) failed');
    results.blExpired = -1;
  }

  try {
    results.slotsExpired = await cleanupExpiredSlots();
  } catch (err) {
    logger.error({ err }, 'Retention cleanup: slots (expired) failed');
    results.slotsExpired = -1;
  }

  try {
    results.auditLog = await cleanupAuditLog();
  } catch (err) {
    logger.error({ err }, 'Retention cleanup: audit_log failed');
    results.auditLog = -1;
  }

  const total = Object.values(results).filter(v => v > 0).reduce((a, b) => a + b, 0);
  if (total > 0) {
    logger.info({ results, total }, 'Retention cleanup completed');
  } else {
    logger.debug('Retention cleanup: no data to anonymize');
  }

  return results;
}

/**
 * Start the retention cleanup interval.
 * @param {number} intervalMs - Interval in ms (default: 24h)
 */
export function startRetentionSchedule(intervalMs) {
  const interval = intervalMs || 24 * 60 * 60 * 1000; // 24h default

  // Run once after a short delay to not block startup
  const initialDelay = setTimeout(() => {
    runRetentionCleanup().catch(err => {
      logger.error({ err }, 'Initial retention cleanup failed');
    });
  }, 30_000); // 30s after startup

  const timer = setInterval(() => {
    runRetentionCleanup().catch(err => {
      logger.error({ err }, 'Scheduled retention cleanup failed');
    });
  }, interval);

  // Allow cleanup of timers for graceful shutdown
  return { timer, initialDelay };
}
