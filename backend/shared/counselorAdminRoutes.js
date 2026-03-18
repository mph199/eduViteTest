/**
 * Shared Counselor Admin Routes Factory
 *
 * Creates an Express router with admin CRUD for counselors, topics, stats,
 * appointments calendar, and weekly schedule management.
 *
 * @param {object} config
 * @param {string}   config.tablePrefix         – 'ssw' or 'bl'
 * @param {Function} config.authMiddleware       – e.g. requireSSW or requireBeratungslehrer
 * @param {string}   config.counselorLabel       – 'Berater/in' or 'Beratungslehrer'
 * @param {string}   config.topicTable           – 'ssw_categories' or 'bl_topics'
 * @param {string}   config.topicResponseKey     – 'categories' or 'topics'
 * @param {string}   config.topicSingularKey     – 'category' or 'topic'
 * @param {string}   config.topicForeignKey      – 'category_id' or 'topic_id'
 * @param {string}   config.topicJoinAlias        – 'category_name' or 'topic_name'
 * @param {string[]} config.topicInsertCols      – columns for INSERT
 * @param {string[]} config.topicUpdateCols      – columns for UPDATE SET
 * @param {Function} config.buildTopicInsertParams  – (body) => [values]
 * @param {Function} config.buildTopicUpdateParams  – (body, id) => [values]
 * @param {Function} config.onCounselorCreated   – async (counselor, req) => { user info }
 * @param {Function} config.onCounselorDeleted   – async (counselorRow) => void
 */

import express from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { generateSlotsForDateRange, upsertWeeklySchedule } from './counselorService.js';
import { assertSafeIdentifier } from './sqlGuards.js';
import logger from '../config/logger.js';
import { validatePassword } from './validatePassword.js';

export function createCounselorAdminRoutes(config) {
  const {
    tablePrefix,
    authMiddleware,
    counselorLabel,
    topicTable,
    topicResponseKey,
    topicSingularKey,
    topicForeignKey,
    topicJoinAlias,
    topicInsertCols,
    topicUpdateCols,
    buildTopicInsertParams,
    buildTopicUpdateParams,
    onCounselorCreated,
    onCounselorDeleted,
  } = config;

  // Validate all identifiers used in SQL interpolation
  assertSafeIdentifier(tablePrefix, 'tablePrefix');
  assertSafeIdentifier(topicTable, 'topicTable');
  assertSafeIdentifier(topicForeignKey, 'topicForeignKey');
  assertSafeIdentifier(topicJoinAlias, 'topicJoinAlias');
  for (const col of topicInsertCols) assertSafeIdentifier(col, 'topicInsertCols');
  for (const col of topicUpdateCols) assertSafeIdentifier(col, 'topicUpdateCols');

  const counselorsTable = `${tablePrefix}_counselors`;
  const appointmentsTable = `${tablePrefix}_appointments`;
  const scheduleTable = `${tablePrefix}_weekly_schedule`;

  const router = express.Router();

  // ── Counselors CRUD ──────────────────────────────────────────────

  router.get('/counselors', authMiddleware, async (_req, res) => {
    try {
      const { rows } = await query(`SELECT id, user_id, first_name, last_name, email, salutation, room, phone, specializations, active, requires_confirmation, created_at FROM ${counselorsTable} ORDER BY last_name, first_name`);
      res.json({ counselors: rows });
    } catch (err) {
      res.status(500).json({ error: `Fehler beim Laden der ${counselorLabel}` });
    }
  });

  router.post('/counselors', authMiddleware, async (req, res) => {
    try {
      const { first_name, last_name, email, salutation, room, phone, specializations,
              available_from, available_until, slot_duration_minutes, requires_confirmation } = req.body || {};

      if (!last_name?.trim()) return res.status(400).json({ error: 'Nachname ist erforderlich' });

      const { rows } = await query(
        `INSERT INTO ${counselorsTable} (first_name, last_name, email, salutation, room, phone,
         specializations, available_from, available_until, slot_duration_minutes, requires_confirmation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
          (first_name || '').trim(),
          last_name.trim(),
          email ? email.trim().toLowerCase() : null,
          salutation || null,
          room ? room.trim() : null,
          phone ? phone.trim() : null,
          specializations || null,
          available_from || '08:00',
          available_until || '14:00',
          slot_duration_minutes || 30,
          requires_confirmation !== false,
        ]
      );

      const counselor = rows[0];

      let userInfo = null;
      if (onCounselorCreated) {
        try {
          userInfo = await onCounselorCreated(counselor, req);
        } catch (userErr) {
          if (userErr.statusCode) {
            return res.status(userErr.statusCode).json({ error: userErr.message });
          }
          logger.warn({ err: userErr }, `User creation for ${counselorLabel} failed`);
        }
      }

      res.json({ success: true, counselor, user: userInfo });
    } catch (err) {
      logger.error({ err }, `${tablePrefix} create counselor error`);
      res.status(500).json({ error: 'Fehler beim Anlegen' });
    }
  });

  router.put('/counselors/:id', authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { first_name, last_name, email, salutation, room, phone, specializations,
              available_from, available_until, slot_duration_minutes, active, requires_confirmation } = req.body || {};

      if (!last_name?.trim()) return res.status(400).json({ error: 'Nachname ist erforderlich' });

      const { rows } = await query(
        `UPDATE ${counselorsTable} SET
           first_name = $1, last_name = $2, email = $3, salutation = $4,
           room = $5, phone = $6, specializations = $7,
           available_from = $8, available_until = $9,
           slot_duration_minutes = $10, active = $11, requires_confirmation = $12
         WHERE id = $13 RETURNING *`,
        [
          (first_name || '').trim(),
          last_name.trim(),
          email ? email.trim().toLowerCase() : null,
          salutation || null,
          room ? room.trim() : null,
          phone ? phone.trim() : null,
          specializations || null,
          available_from || '08:00',
          available_until || '14:00',
          slot_duration_minutes || 30,
          active !== false,
          requires_confirmation !== false,
          id,
        ]
      );

      if (!rows.length) return res.status(404).json({ error: `${counselorLabel} nicht gefunden` });

      const counselor = rows[0];
      if (counselor.user_id) {
        try {
          await query('UPDATE users SET email = $1 WHERE id = $2', [
            email ? email.trim().toLowerCase() : null,
            counselor.user_id,
          ]);
        } catch (syncErr) {
          logger.warn({ err: syncErr }, 'Email sync to user failed');
        }
      }

      res.json({ success: true, counselor });
    } catch (err) {
      logger.error({ err }, `${tablePrefix} update counselor error`);
      res.status(500).json({ error: 'Fehler beim Speichern' });
    }
  });

  router.delete('/counselors/:id', authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

      const { rows: counselorRows } = await query(`SELECT user_id FROM ${counselorsTable} WHERE id = $1`, [id]);
      const counselorRow = counselorRows[0];

      const { rows } = await query(`DELETE FROM ${counselorsTable} WHERE id = $1 RETURNING id`, [id]);
      if (!rows.length) return res.status(404).json({ error: `${counselorLabel} nicht gefunden` });

      if (counselorRow?.user_id && onCounselorDeleted) {
        await onCounselorDeleted(counselorRow);
      }

      res.json({ success: true });
    } catch (err) {
      if (err?.code === '23503') {
        return res.status(409).json({ error: `${counselorLabel} hat noch Termine. Bitte zuerst Termine löschen oder deaktivieren.` });
      }
      res.status(500).json({ error: 'Fehler beim Löschen' });
    }
  });

  // ── Topics/Categories CRUD ───────────────────────────────────────

  router.get(`/${topicResponseKey}`, authMiddleware, async (_req, res) => {
    try {
      const { rows } = await query(`SELECT * FROM ${topicTable} ORDER BY sort_order, id`);
      res.json({ [topicResponseKey]: rows });
    } catch (err) {
      res.status(500).json({ error: `Fehler beim Laden der ${topicResponseKey}` });
    }
  });

  router.post(`/${topicResponseKey}`, authMiddleware, async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.name?.trim()) return res.status(400).json({ error: 'Name ist erforderlich' });

      const cols = topicInsertCols.join(', ');
      const placeholders = topicInsertCols.map((_, i) => `$${i + 1}`).join(', ');
      const params = buildTopicInsertParams(body);

      const { rows } = await query(
        `INSERT INTO ${topicTable} (${cols}) VALUES (${placeholders}) RETURNING *`,
        params
      );
      res.json({ success: true, [topicSingularKey]: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Fehler beim Anlegen' });
    }
  });

  router.put(`/${topicResponseKey}/:id`, authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const body = req.body || {};
      if (!body.name?.trim()) return res.status(400).json({ error: 'Name ist erforderlich' });

      const setClauses = topicUpdateCols.map((col, i) => `${col} = $${i + 1}`).join(', ');
      const params = buildTopicUpdateParams(body, id);

      const { rows } = await query(
        `UPDATE ${topicTable} SET ${setClauses} WHERE id = $${topicUpdateCols.length + 1} RETURNING *`,
        params
      );
      if (!rows.length) return res.status(404).json({ error: `${topicSingularKey} nicht gefunden` });
      res.json({ success: true, [topicSingularKey]: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Fehler beim Speichern' });
    }
  });

  // ── Stats ────────────────────────────────────────────────────────

  router.get('/stats', authMiddleware, async (_req, res) => {
    try {
      const { rows: [counts] } = await query(`
        SELECT
          (SELECT COUNT(*) FROM ${counselorsTable} WHERE active = TRUE) AS counselors,
          (SELECT COUNT(*) FROM ${appointmentsTable} WHERE status = 'requested') AS pending,
          (SELECT COUNT(*) FROM ${appointmentsTable} WHERE status = 'confirmed') AS confirmed,
          (SELECT COUNT(*) FROM ${appointmentsTable} WHERE status = 'available' AND date >= CURRENT_DATE) AS available
      `);
      res.json({ stats: counts });
    } catch (err) {
      res.status(500).json({ error: 'Fehler beim Laden der Statistiken' });
    }
  });

  // ── Appointments (calendar management) ───────────────────────────

  router.get('/appointments', authMiddleware, async (req, res) => {
    try {
      const counselorId = parseInt(req.query.counselor_id, 10);
      if (!counselorId) return res.status(400).json({ error: 'counselor_id erforderlich' });

      const dateFrom = req.query.date_from;
      const dateUntil = req.query.date_until;
      if (!dateFrom || !dateUntil) return res.status(400).json({ error: 'date_from und date_until erforderlich' });

      const { rows } = await query(
        `SELECT a.*, t.name AS ${topicJoinAlias}
         FROM ${appointmentsTable} a
         LEFT JOIN ${topicTable} t ON t.id = a.${topicForeignKey}
         WHERE a.counselor_id = $1 AND a.date >= $2 AND a.date <= $3 AND a.restricted IS NOT TRUE
         ORDER BY a.date, a.time`,
        [counselorId, dateFrom, dateUntil]
      );
      res.json({ appointments: rows });
    } catch (err) {
      logger.error({ err }, `${tablePrefix} admin appointments error`);
      res.status(500).json({ error: 'Fehler beim Laden der Termine' });
    }
  });

  router.delete('/appointments', authMiddleware, async (req, res) => {
    try {
      const { ids } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids-Array erforderlich' });
      }

      const numericIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (numericIds.length === 0) return res.status(400).json({ error: 'Keine gueltigen IDs' });

      const placeholders = numericIds.map((_, i) => `$${i + 1}`).join(', ');
      const { rowCount } = await query(
        `DELETE FROM ${appointmentsTable} WHERE id IN (${placeholders})`,
        numericIds
      );
      res.json({ success: true, deleted: rowCount });
    } catch (err) {
      logger.error({ err }, `${tablePrefix} admin delete appointments error`);
      res.status(500).json({ error: 'Fehler beim Löschen' });
    }
  });

  // ── Weekly Schedule ──────────────────────────────────────────────

  router.get('/counselors/:id/schedule', authMiddleware, async (req, res) => {
    try {
      const counselorId = parseInt(req.params.id, 10);
      const { rows } = await query(
        `SELECT * FROM ${scheduleTable} WHERE counselor_id = $1 ORDER BY weekday`,
        [counselorId]
      );
      res.json({ schedule: rows });
    } catch (err) {
      res.status(500).json({ error: 'Fehler beim Laden des Wochenplans' });
    }
  });

  router.put('/counselors/:id/schedule', authMiddleware, async (req, res) => {
    try {
      const counselorId = parseInt(req.params.id, 10);
      const { schedule } = req.body || {};
      const rows = await upsertWeeklySchedule(counselorId, schedule, scheduleTable);
      res.json({ success: true, schedule: rows });
    } catch (err) {
      if (err.statusCode === 400) return res.status(400).json({ error: err.message });
      logger.error({ err }, `${tablePrefix} schedule update error`);
      res.status(500).json({ error: 'Fehler beim Speichern des Wochenplans' });
    }
  });

  // ── Generate Slots (admin) ──────────────────────────────────────

  router.post('/counselors/:id/generate-slots', authMiddleware, async (req, res) => {
    try {
      const counselorId = parseInt(req.params.id, 10);
      const { date_from, date_until, exclude_weekends = true } = req.body || {};

      if (!date_from || !/^\d{4}-\d{2}-\d{2}$/.test(date_from)) {
        return res.status(400).json({ error: 'date_from im Format YYYY-MM-DD erforderlich' });
      }

      const tables = { counselorsTable, appointmentsTable, scheduleTable, counselorLabel };
      const result = await generateSlotsForDateRange(counselorId, { date_from, date_until, exclude_weekends }, tables);
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) return res.status(err.statusCode).json({ error: err.message });
      logger.error({ err }, `${tablePrefix} admin generate-slots error`);
      res.status(500).json({ error: 'Fehler beim Erstellen der Termine' });
    }
  });

  return router;
}

export { generateUsername } from './generateUsername.js';

/**
 * Helper: create or upsert a user account for a counselor.
 */
export async function createCounselorUser(counselor, req, config) {
  const { tablePrefix, userRole, moduleKey } = config;
  const { username: reqUsername, password: reqPassword } = req.body || {};

  const uname = (reqUsername && typeof reqUsername === 'string' && reqUsername.trim())
    ? reqUsername.trim()
    : generateUsername(counselor.first_name, counselor.last_name, counselor.id, tablePrefix);

  const isManualPassword = reqPassword && typeof reqPassword === 'string' && reqPassword.trim();
  const tempPassword = isManualPassword
    ? reqPassword.trim()
    : crypto.randomBytes(6).toString('base64url');

  // Enforce password complexity for manually provided passwords
  if (isManualPassword) {
    const pwCheck = validatePassword(tempPassword);
    if (!pwCheck.valid) {
      throw Object.assign(new Error(pwCheck.message), { statusCode: 400 });
    }
  }

  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const parsedEmail = counselor.email || null;

  // Check for existing username to avoid silent overwrite
  const { rows: existing } = await query('SELECT id FROM users WHERE username = $1', [uname]);
  if (existing.length > 0) {
    throw Object.assign(new Error('Benutzername ist bereits vergeben'), { statusCode: 409 });
  }

  const { rows: userRows } = await query(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [uname, parsedEmail, passwordHash, userRole]
  );

  if (userRows[0]) {
    await query(`UPDATE ${tablePrefix}_counselors SET user_id = $1 WHERE id = $2`, [userRows[0].id, counselor.id]);
    counselor.user_id = userRows[0].id;

    // Grant module access if needed
    if (moduleKey) {
      await query(
        'INSERT INTO user_module_access (user_id, module_key) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userRows[0].id, moduleKey]
      );
    }

    return { username: uname, tempPassword };
  }
  return null;
}
