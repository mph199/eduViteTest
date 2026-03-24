/**
 * Shared Token-Utilities für Kalender-Abo.
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
