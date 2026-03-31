/**
 * Configurable retention periods for PII data.
 *
 * All values in days. Override via environment variables.
 * Used by retention-cleanup cron job and manual anonymization endpoints.
 */

const defaults = {
  // Elternsprechtag: days after event is closed
  RETENTION_BOOKING_REQUESTS_DAYS: 180,
  // SSW/BL: days after appointment date
  RETENTION_SSW_APPOINTMENTS_DAYS: 365,
  RETENTION_BL_APPOINTMENTS_DAYS: 365,
  // Cancelled appointments: days after cancellation
  RETENTION_CANCELLED_DAYS: 30,
  // Audit log: days to keep entries
  RETENTION_AUDIT_LOG_DAYS: 730,
  // Flow activity log: days to keep entries
  RETENTION_FLOW_AKTIVITAET_DAYS: 730,
};

function envInt(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const retention = {
  bookingRequestsDays: envInt('RETENTION_BOOKING_REQUESTS_DAYS', defaults.RETENTION_BOOKING_REQUESTS_DAYS),
  sswAppointmentsDays: envInt('RETENTION_SSW_APPOINTMENTS_DAYS', defaults.RETENTION_SSW_APPOINTMENTS_DAYS),
  blAppointmentsDays: envInt('RETENTION_BL_APPOINTMENTS_DAYS', defaults.RETENTION_BL_APPOINTMENTS_DAYS),
  cancelledDays: envInt('RETENTION_CANCELLED_DAYS', defaults.RETENTION_CANCELLED_DAYS),
  auditLogDays: envInt('RETENTION_AUDIT_LOG_DAYS', defaults.RETENTION_AUDIT_LOG_DAYS),
  flowAktivitaetDays: envInt('RETENTION_FLOW_AKTIVITAET_DAYS', defaults.RETENTION_FLOW_AKTIVITAET_DAYS),
};

export default retention;
