/**
 * Retention Cleanup Job
 *
 * Automatically anonymizes PII data that has exceeded its retention period.
 * Runs on a configurable interval (default: daily at startup + every 24h).
 */

import { sql } from 'kysely';
import { db } from '../db/database.js';
import retention from '../config/retention.js';
import logger from '../config/logger.js';

async function cleanupBookingRequests() {
  const events = await sql`
    SELECT id FROM events
    WHERE status = 'closed'
      AND closed_at IS NOT NULL
      AND closed_at < NOW() - MAKE_INTERVAL(days => ${retention.bookingRequestsDays})
  `.execute(db);

  let total = 0;
  for (const event of events.rows) {
    const result = await sql`SELECT anonymize_booking_requests(${event.id}) AS affected`.execute(db);
    total += result.rows[0]?.affected || 0;
  }
  return total;
}

async function cleanupSswAppointments() {
  const result = await sql`
    UPDATE ssw_appointments
    SET first_name = NULL, last_name = NULL, student_class = NULL,
        email = NULL, phone = NULL, updated_at = NOW()
    WHERE status = 'cancelled'
      AND updated_at < NOW() - MAKE_INTERVAL(days => ${retention.cancelledDays})
      AND (first_name IS NOT NULL OR last_name IS NOT NULL OR email IS NOT NULL)
    RETURNING id
  `.execute(db);
  return result.rows.length;
}

async function cleanupBlAppointments() {
  const result = await sql`
    UPDATE bl_appointments
    SET first_name = NULL, last_name = NULL, student_class = NULL,
        email = NULL, phone = NULL, updated_at = NOW()
    WHERE status = 'cancelled'
      AND updated_at < NOW() - MAKE_INTERVAL(days => ${retention.cancelledDays})
      AND (first_name IS NOT NULL OR last_name IS NOT NULL OR email IS NOT NULL)
    RETURNING id
  `.execute(db);
  return result.rows.length;
}

async function cleanupExpiredSswAppointments() {
  const result = await sql`
    UPDATE ssw_appointments
    SET first_name = NULL, last_name = NULL, student_class = NULL,
        email = NULL, phone = NULL, updated_at = NOW()
    WHERE date::date < CURRENT_DATE - MAKE_INTERVAL(days => ${retention.sswAppointmentsDays})
      AND (first_name IS NOT NULL OR last_name IS NOT NULL OR email IS NOT NULL)
    RETURNING id
  `.execute(db);
  return result.rows.length;
}

async function cleanupExpiredBlAppointments() {
  const result = await sql`
    UPDATE bl_appointments
    SET first_name = NULL, last_name = NULL, student_class = NULL,
        email = NULL, phone = NULL, updated_at = NOW()
    WHERE date::date < CURRENT_DATE - MAKE_INTERVAL(days => ${retention.blAppointmentsDays})
      AND (first_name IS NOT NULL OR last_name IS NOT NULL OR email IS NOT NULL)
    RETURNING id
  `.execute(db);
  return result.rows.length;
}

async function cleanupExpiredSlots() {
  const result = await sql`
    UPDATE slots s
    SET parent_name = NULL, student_name = NULL, company_name = NULL,
        trainee_name = NULL, representative_name = NULL, class_name = NULL,
        email = NULL, message = NULL, verification_token_hash = NULL,
        updated_at = NOW()
    FROM events e
    WHERE s.event_id = e.id
      AND e.status = 'closed'
      AND e.closed_at IS NOT NULL
      AND e.closed_at < NOW() - MAKE_INTERVAL(days => ${retention.bookingRequestsDays})
      AND (s.parent_name IS NOT NULL OR s.email IS NOT NULL)
    RETURNING s.id
  `.execute(db);
  return result.rows.length;
}

async function cleanupFlowAktivitaet() {
  const result = await sql`
    DELETE FROM flow_aktivitaet
    WHERE created_at < NOW() - MAKE_INTERVAL(days => ${retention.flowAktivitaetDays})
  `.execute(db);
  return Number(result.numAffectedRows ?? 0);
}

async function cleanupAuditLog() {
  const result = await sql`
    DELETE FROM audit_log
    WHERE created_at < NOW() - MAKE_INTERVAL(days => ${retention.auditLogDays})
  `.execute(db);
  return Number(result.numAffectedRows ?? 0);
}

export async function runRetentionCleanup() {
  const results = {};

  const tasks = [
    ['bookingRequests', cleanupBookingRequests],
    ['sswCancelled', cleanupSswAppointments],
    ['blCancelled', cleanupBlAppointments],
    ['sswExpired', cleanupExpiredSswAppointments],
    ['blExpired', cleanupExpiredBlAppointments],
    ['slotsExpired', cleanupExpiredSlots],
    ['auditLog', cleanupAuditLog],
    ['flowAktivitaet', cleanupFlowAktivitaet],
  ];

  for (const [key, fn] of tasks) {
    try {
      results[key] = await fn();
    } catch (err) {
      logger.error({ err }, `Retention cleanup: ${key} failed`);
      results[key] = -1;
    }
  }

  const total = Object.values(results).filter(v => v > 0).reduce((a, b) => a + b, 0);
  if (total > 0) {
    logger.info({ results, total }, 'Retention cleanup completed');
  } else {
    logger.debug('Retention cleanup: no data to anonymize');
  }

  return results;
}

export function startRetentionSchedule(intervalMs) {
  const interval = intervalMs || 24 * 60 * 60 * 1000;

  const initialDelay = setTimeout(() => {
    runRetentionCleanup().catch(err => {
      logger.error({ err }, 'Initial retention cleanup failed');
    });
  }, 30_000);

  const timer = setInterval(() => {
    runRetentionCleanup().catch(err => {
      logger.error({ err }, 'Scheduled retention cleanup failed');
    });
  }, interval);

  return { timer, initialDelay };
}
