import express from 'express';
import { requireSuperadmin } from '../../middleware/auth.js';
import { query, getClient } from '../../config/db.js';

import logger from '../../config/logger.js';
import { assertSafeIdentifier } from '../../shared/sqlGuards.js';
import { writeAuditLog } from '../../middleware/audit-log.js';
import { EMAIL_RE } from '../../utils/validators.js';

const router = express.Router();

/**
 * Escape a value for semicolon-separated CSV.
 */
function csvEscapeValue(val) {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  return str.includes(';') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * Convert an array of rows to CSV lines (semicolon-separated).
 */
function rowsToCsvLines(headers, rows) {
  const lines = [headers.join(';')];
  for (const row of rows) {
    lines.push(headers.map(h => csvEscapeValue(row[h])).join(';'));
  }
  return lines;
}

/**
 * Collect all PII for a given email across all relevant tables.
 */
async function collectPersonData(email) {
  const data = {};

  // 1. Teachers
  const teachers = await query(
    `SELECT id, name, email, subject, created_at
     FROM teachers WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  if (teachers.rows.length > 0) data.teachers = teachers.rows;

  // 2. Users
  const users = await query(
    `SELECT id, username, email, role, teacher_id, created_at
     FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  if (users.rows.length > 0) data.users = users.rows;

  // 3. Booking Requests (Elternsprechtag)
  const bookingRequests = await query(
    `SELECT id, event_id, teacher_id, parent_name, student_name, company_name,
            trainee_name, representative_name, email, message, visitor_type,
            class_name, status, restricted, created_at, updated_at
     FROM booking_requests WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  if (bookingRequests.rows.length > 0) data.booking_requests = bookingRequests.rows;

  // 4. Slots (booked by this email)
  const slots = await query(
    `SELECT id, teacher_id, event_id, date, time, booked, status,
            visitor_type, parent_name, student_name, company_name, trainee_name,
            representative_name, class_name, email, message, verified_at, created_at, updated_at
     FROM slots WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  if (slots.rows.length > 0) data.slots = slots.rows;

  // 5. SSW Appointments
  const sswAppointments = await query(
    `SELECT id, counselor_id, first_name, last_name, student_class, email, phone,
            date, time, duration_minutes, status, restricted, created_at, updated_at
     FROM ssw_appointments WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  if (sswAppointments.rows.length > 0) data.ssw_appointments = sswAppointments.rows;

  // 6. BL Appointments
  const blAppointments = await query(
    `SELECT id, counselor_id, first_name, last_name, student_class, email, phone,
            date, time, duration_minutes, status, restricted, created_at, updated_at
     FROM bl_appointments WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  if (blAppointments.rows.length > 0) data.bl_appointments = blAppointments.rows;

  // 7. Consent Receipts (no email column – lookup via related appointments)
  // consent_receipts has no direct email reference; skipped (no email FK)

  return data;
}

/**
 * Convert data object to CSV string.
 */
function dataToCsv(data) {
  const lines = [];

  for (const [tableName, rows] of Object.entries(data)) {
    if (!Array.isArray(rows) || rows.length === 0) continue;
    lines.push(`--- ${tableName} ---`);
    const headers = Object.keys(rows[0]);
    lines.push(...rowsToCsvLines(headers, rows));
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Routes – all require superadmin
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/data-subject/search?email=
 * Art. 15 DSGVO: Datenauskunft – PII-Suche ueber alle Tabellen.
 */
router.get('/data-subject/search', requireSuperadmin, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'Gueltige E-Mail-Adresse erforderlich' });
    }

    const data = await collectPersonData(email.trim());
    const totalRecords = Object.values(data).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);

    await writeAuditLog(req.user?.id, 'READ', 'data_subject', null, { email: email.trim(), tables: Object.keys(data) }, req.ip);

    res.json({ email: email.trim(), total_records: totalRecords, data });
  } catch (err) {
    logger.error({ err }, 'data-subject search failed');
    res.status(500).json({ error: 'Suche fehlgeschlagen' });
  }
});

/**
 * GET /api/admin/data-subject/export?email=&format=json|csv
 * Art. 15 + Art. 20 DSGVO: Datenexport / Datenuebertragbarkeit.
 */
router.get('/data-subject/export', requireSuperadmin, async (req, res) => {
  try {
    const { email, format = 'json' } = req.query;
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'Gueltige E-Mail-Adresse erforderlich' });
    }

    const data = await collectPersonData(email.trim());

    await writeAuditLog(req.user?.id, 'EXPORT', 'data_subject', null, { email: email.trim(), format }, req.ip);

    if (format === 'csv') {
      const csv = dataToCsv(data);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="datenauskunft-${Date.now()}.csv"`);
      return res.send(csv);
    }

    // Default: JSON
    const exportData = {
      export_date: new Date().toISOString(),
      data_subject: email.trim(),
      data,
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="datenauskunft-${Date.now()}.json"`);
    res.json(exportData);
  } catch (err) {
    logger.error({ err }, 'data-subject export failed');
    res.status(500).json({ error: 'Export fehlgeschlagen' });
  }
});

/**
 * DELETE /api/admin/data-subject?email=
 * Art. 17 DSGVO: Recht auf Loeschung (Anonymisierung).
 * Prueft Aufbewahrungsfristen und erstellt Loeschprotokoll.
 */
router.delete('/data-subject', requireSuperadmin, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'Gueltige E-Mail-Adresse erforderlich' });
    }

    const trimmedEmail = email.trim();
    const protocol = { email: trimmedEmail, timestamp: new Date().toISOString(), actions: [] };

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // 1. Anonymize booking_requests (via DB function for consistency)
      const brResult = await client.query(
        'SELECT anonymize_booking_requests_by_email(LOWER($1)) AS affected',
        [trimmedEmail]
      );
      const brAffected = brResult.rows[0]?.affected || 0;
      if (brAffected > 0) {
        protocol.actions.push({ table: 'booking_requests', anonymized: brAffected });
      }

      // 2. Anonymize slots
      const slotsResult = await client.query(
        `UPDATE slots
         SET parent_name = NULL, student_name = NULL, company_name = NULL,
             trainee_name = NULL, representative_name = NULL, class_name = NULL,
             email = NULL, message = NULL, verification_token_hash = NULL,
             updated_at = NOW()
         WHERE LOWER(email) = LOWER($1) AND email IS NOT NULL
         RETURNING id`,
        [trimmedEmail]
      );
      if (slotsResult.rows.length > 0) {
        protocol.actions.push({ table: 'slots', anonymized: slotsResult.rows.length, ids: slotsResult.rows.map(r => r.id) });
      }

      // 3. Anonymize SSW appointments
      const sswResult = await client.query(
        `UPDATE ssw_appointments
         SET first_name = NULL, last_name = NULL, student_class = NULL, email = NULL, phone = NULL,
             restricted = TRUE, updated_at = NOW()
         WHERE LOWER(email) = LOWER($1) AND email IS NOT NULL
         RETURNING id`,
        [trimmedEmail]
      );
      if (sswResult.rows.length > 0) {
        protocol.actions.push({ table: 'ssw_appointments', anonymized: sswResult.rows.length, ids: sswResult.rows.map(r => r.id) });
      }

      // 4. Anonymize BL appointments
      const blResult = await client.query(
        `UPDATE bl_appointments
         SET first_name = NULL, last_name = NULL, student_class = NULL, email = NULL, phone = NULL,
             restricted = TRUE, updated_at = NOW()
         WHERE LOWER(email) = LOWER($1) AND email IS NOT NULL
         RETURNING id`,
        [trimmedEmail]
      );
      if (blResult.rows.length > 0) {
        protocol.actions.push({ table: 'bl_appointments', anonymized: blResult.rows.length, ids: blResult.rows.map(r => r.id) });
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    const totalAnonymized = protocol.actions.reduce((sum, a) => sum + a.anonymized, 0);

    await writeAuditLog(req.user?.id, 'DELETE', 'data_subject', null, protocol, req.ip);

    res.json({
      message: `${totalAnonymized} Datensaetze anonymisiert`,
      protocol,
    });
  } catch (err) {
    logger.error({ err }, 'data-subject deletion failed');
    res.status(500).json({ error: 'Loeschung fehlgeschlagen' });
  }
});

/**
 * PATCH /api/admin/data-subject?email=
 * Art. 16 DSGVO: Recht auf Berichtigung.
 * Body: { corrections: { field: newValue, ... } }
 */
router.patch('/data-subject', requireSuperadmin, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'Gueltige E-Mail-Adresse erforderlich' });
    }

    const { corrections } = req.body;
    if (!corrections || typeof corrections !== 'object' || Object.keys(corrections).length === 0) {
      return res.status(400).json({ error: 'Korrekturen erforderlich (corrections-Objekt)' });
    }

    const trimmedEmail = email.trim();
    const allowedFields = {
      booking_requests: ['parent_name', 'student_name', 'company_name', 'trainee_name', 'representative_name', 'email', 'class_name'],
      slots: ['parent_name', 'student_name', 'company_name', 'trainee_name', 'representative_name', 'email', 'class_name'],
      ssw_appointments: ['first_name', 'last_name', 'student_class', 'email', 'phone'],
      bl_appointments: ['first_name', 'last_name', 'student_class', 'email', 'phone'],
      teachers: ['name', 'email', 'subject'],
    };

    const results = [];
    const client = await getClient();

    try {
      await client.query('BEGIN');

      for (const [table, fields] of Object.entries(allowedFields)) {
        assertSafeIdentifier(table, 'table');
        const updates = {};
        for (const field of fields) {
          if (corrections[field] !== undefined) {
            updates[field] = corrections[field];
          }
        }
        if (Object.keys(updates).length === 0) continue;

        const updateKeys = Object.keys(updates);
        for (const k of updateKeys) assertSafeIdentifier(k, 'column');

        const setClauses = updateKeys.map((k, i) => `${k} = $${i + 1}`);
        const values = Object.values(updates);
        const emailParamIdx = values.length + 1;
        setClauses.push(`updated_at = NOW()`);

        const result = await client.query(
          `UPDATE ${table} SET ${setClauses.join(', ')} WHERE LOWER(email) = LOWER($${emailParamIdx}) AND email IS NOT NULL RETURNING id`,
          [...values, trimmedEmail]
        );

        if (result.rows.length > 0) {
          results.push({ table, corrected: result.rows.length, fields: updateKeys });
        }
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    await writeAuditLog(req.user?.id, 'WRITE', 'data_subject', null, {
      email: trimmedEmail,
      corrections,
      results,
    }, req.ip);

    const totalCorrected = results.reduce((sum, r) => sum + r.corrected, 0);
    res.json({
      message: `${totalCorrected} Datensaetze berichtigt`,
      results,
    });
  } catch (err) {
    logger.error({ err }, 'data-subject correction failed');
    res.status(500).json({ error: 'Berichtigung fehlgeschlagen' });
  }
});

/**
 * POST /api/admin/data-subject/restrict?email=
 * Art. 18 DSGVO: Verarbeitungseinschraenkung.
 * Body: { restricted: true|false }
 */
router.post('/data-subject/restrict', requireSuperadmin, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'Gueltige E-Mail-Adresse erforderlich' });
    }

    const restricted = req.body.restricted !== false; // default true
    const trimmedEmail = email.trim();
    const results = [];

    // Set restricted flag on all tables that have it
    for (const table of ['booking_requests', 'ssw_appointments', 'bl_appointments']) {
      assertSafeIdentifier(table, 'table');
      const result = await query(
        `UPDATE ${table} SET restricted = $1, updated_at = NOW() WHERE LOWER(email) = LOWER($2) AND email IS NOT NULL RETURNING id`,
        [restricted, trimmedEmail]
      );
      if (result.rows.length > 0) {
        results.push({ table, affected: result.rows.length });
      }
    }

    await writeAuditLog(req.user?.id, 'RESTRICT', 'data_subject', null, {
      email: trimmedEmail,
      restricted,
      results,
    }, req.ip);

    const totalAffected = results.reduce((sum, r) => sum + r.affected, 0);
    res.json({
      message: `Verarbeitungseinschraenkung ${restricted ? 'aktiviert' : 'aufgehoben'} fuer ${totalAffected} Datensaetze`,
      restricted,
      results,
    });
  } catch (err) {
    logger.error({ err }, 'data-subject restriction failed');
    res.status(500).json({ error: 'Einschraenkung fehlgeschlagen' });
  }
});

/**
 * GET /api/admin/audit-log?from=&to=&action=&table=&page=&limit=
 * Audit-Log-Abfrage mit Filterung und Pagination.
 */
const ALLOWED_AUDIT_ACTIONS = ['READ', 'WRITE', 'DELETE', 'EXPORT', 'RESTRICT', 'LOGIN_FAIL', 'ACCESS_DENIED'];
const ALLOWED_AUDIT_TABLES = ['data_subject', 'security', 'audit_log', 'booking_requests', 'slots', 'ssw_appointments', 'bl_appointments', 'teachers', 'users'];

router.get('/audit-log', requireSuperadmin, async (req, res) => {
  try {
    const { from, to, action, table, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (from) {
      if (isNaN(Date.parse(from))) return res.status(400).json({ error: 'Ungueltiges Startdatum' });
      conditions.push(`a.created_at >= $${paramIdx++}`);
      params.push(from);
    }
    if (to) {
      if (isNaN(Date.parse(to))) return res.status(400).json({ error: 'Ungueltiges Enddatum' });
      conditions.push(`a.created_at <= $${paramIdx++}`);
      params.push(to);
    }
    if (action) {
      if (!ALLOWED_AUDIT_ACTIONS.includes(action)) return res.status(400).json({ error: 'Ungueltige Aktion' });
      conditions.push(`a.action = $${paramIdx++}`);
      params.push(action);
    }
    if (table) {
      if (!ALLOWED_AUDIT_TABLES.includes(table)) return res.status(400).json({ error: 'Ungueltiger Tabellenname' });
      conditions.push(`a.table_name = $${paramIdx++}`);
      params.push(table);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM audit_log a ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    const dataResult = await query(
      `SELECT a.id, a.user_id, u.username AS user_name, a.action, a.table_name,
              a.record_id, a.details, a.ip_address, a.created_at
       FROM audit_log a
       LEFT JOIN users u ON a.user_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limitNum, offset]
    );

    res.json({
      entries: Array.isArray(dataResult.rows) ? dataResult.rows : [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    logger.error({ err }, 'audit-log query failed');
    res.status(500).json({ error: 'Audit-Log-Abfrage fehlgeschlagen' });
  }
});

/**
 * GET /api/admin/audit-log/export?from=&to=&format=csv
 * Audit-Log-Export fuer Behoerdenanfragen.
 */
router.get('/audit-log/export', requireSuperadmin, async (req, res) => {
  try {
    const { from, to, format = 'csv' } = req.query;
    const EXPORT_LIMIT = 10000;

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (from) {
      if (isNaN(Date.parse(from))) return res.status(400).json({ error: 'Ungueltiges Startdatum' });
      conditions.push(`a.created_at >= $${paramIdx++}`);
      params.push(from);
    }
    if (to) {
      if (isNaN(Date.parse(to))) return res.status(400).json({ error: 'Ungueltiges Enddatum' });
      conditions.push(`a.created_at <= $${paramIdx++}`);
      params.push(to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(EXPORT_LIMIT);
    const result = await query(
      `SELECT a.id, a.user_id, u.username AS user_name, a.action, a.table_name,
              a.record_id, a.details, a.ip_address, a.created_at
       FROM audit_log a
       LEFT JOIN users u ON a.user_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${paramIdx}`,
      params
    );

    const rows = Array.isArray(result.rows) ? result.rows : [];
    const truncated = rows.length >= EXPORT_LIMIT;

    await writeAuditLog(req.user?.id, 'EXPORT', 'audit_log', null, { from, to, count: rows.length, truncated }, req.ip);

    if (format === 'csv') {
      const headers = ['id', 'user_id', 'user_name', 'action', 'table_name', 'record_id', 'details', 'ip_address', 'created_at'];
      const csvLines = rowsToCsvLines(headers, rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit-log-${Date.now()}.csv"`);
      return res.send(csvLines.join('\n'));
    }

    res.json({ entries: rows });
  } catch (err) {
    logger.error({ err }, 'audit-log export failed');
    res.status(500).json({ error: 'Audit-Log-Export fehlgeschlagen' });
  }
});

export default router;
