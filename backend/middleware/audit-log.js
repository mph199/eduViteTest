import { query } from '../config/db.js';
import logger from '../config/logger.js';

/**
 * Write an entry to the audit_log table (fire-and-forget).
 * Used by middleware and route handlers to log PII access and security events.
 */
export async function writeAuditLog(userId, action, tableName, recordId, details, ipAddress) {
  try {
    await query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId || null, action, tableName || null, recordId || null, details ? JSON.stringify(details) : '{}', ipAddress || null]
    );
  } catch (err) {
    logger.error({ err, action, tableName }, 'Failed to write audit log');
  }
}

/**
 * Log a security event (failed login, 403, rate limit hit).
 */
export async function logSecurityEvent(action, details, ipAddress) {
  try {
    await writeAuditLog(null, action, 'security', null, details, ipAddress);
  } catch (err) {
    logger.error({ err, action }, 'Failed to log security event');
  }
}
