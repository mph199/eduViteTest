/**
 * Shared Token-Utilities für Kalender-Abo und Verifikation.
 */

/**
 * Berechnet expiresAt via echter Monatsarithmetik (nicht 365 Tage).
 * @param {string|Date} createdAt
 * @returns {Date}
 */
export function getExpiresAt(createdAt) {
  const d = new Date(createdAt);
  d.setMonth(d.getMonth() + 12);
  return d;
}

/**
 * Gibt die Verification-Token-TTL in Millisekunden zurück.
 * Liest VERIFICATION_TOKEN_TTL_HOURS aus der Umgebung (Default: 72h).
 * @returns {number}
 */
export function getVerificationTtlMs() {
  const ttlHoursRaw = process.env.VERIFICATION_TOKEN_TTL_HOURS;
  const ttlHours = Number.parseInt(ttlHoursRaw || '72', 10);
  return (Number.isFinite(ttlHours) ? ttlHours : 72) * 60 * 60 * 1000;
}
