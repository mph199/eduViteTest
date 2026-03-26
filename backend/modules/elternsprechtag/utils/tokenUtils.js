/**
 * Re-Export aus shared/tokenUtils.js (Abwärtskompatibilität).
 *
 * Bestehende Imports innerhalb des Elternsprechtag-Moduls bleiben
 * funktional — neue Module importieren direkt aus shared/.
 */
export { getExpiresAt, getVerificationTtlMs } from '../../../shared/tokenUtils.js';
