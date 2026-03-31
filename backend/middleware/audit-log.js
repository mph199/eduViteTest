import { db } from '../db/database.js';
import logger from '../config/logger.js';

/**
 * Write an entry to the audit_log table (fire-and-forget).
 */
export async function writeAuditLog(userId, action, tableName, recordId, details, ipAddress) {
  try {
    await db.insertInto('audit_log')
      .values({
        user_id: userId || null,
        action,
        table_name: tableName || null,
        record_id: recordId || null,
        details: details ? JSON.stringify(details) : '{}',
        ip_address: ipAddress || null,
      })
      .execute();
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
