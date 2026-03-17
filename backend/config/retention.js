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
};

export default retention;
