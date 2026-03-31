/**
 * Shared Counselor Admin Routes Factory
 *
 * Creates an Express router with admin CRUD for counselors, topics, stats,
 * appointments calendar, and weekly schedule management.
 *
 * @param {object} config
 * @param {string}   config.tablePrefix         – 'ssw' or 'bl'
 * @param {Function} config.authMiddleware       – e.g. requireModuleAdmin('schulsozialarbeit')
 * @param {string}   config.counselorLabel       – 'Berater/in' or 'Beratungslehrer'
 * @param {Function} config.onCounselorCreated   – async (counselor, req) => { user info }
 * @param {Function} config.onCounselorDeleted   – async (counselorRow) => void
 */

import express from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';
import { sql } from 'kysely';
import { generateSlotsForDateRange, upsertWeeklySchedule } from './counselorService.js';
import { assertSafeIdentifier } from './sqlGuards.js';
import { generateUsername } from './generateUsername.js';
import logger from '../config/logger.js';
import { validatePassword } from './validatePassword.js';
import { writeAuditLog } from '../middleware/audit-log.js';

export function createCounselorAdminRoutes(config) {
  const {
    tablePrefix,
    authMiddleware,
    counselorLabel,
    onCounselorCreated,
    onCounselorDeleted,
  } = config;

  // Validate all identifiers used in SQL interpolation
  assertSafeIdentifier(tablePrefix, 'tablePrefix');

  const counselorsTable = `${tablePrefix}_counselors`;
  const appointmentsTable = `${tablePrefix}_appointments`;
  const scheduleTable = `${tablePrefix}_weekly_schedule`;

  const router = express.Router();

  // ── Counselors CRUD ──────────────────────────────────────────────

  router.get('/counselors', authMiddleware, async (_req, res) => {
    try {
      const { rows } = await sql`
        SELECT id, user_id, first_name, last_name, email, salutation, room, phone,
               specializations, active, requires_confirmation, created_at
        FROM ${sql.table(counselorsTable)}
        ORDER BY last_name, first_name
      `.execute(db);
      res.json({ counselors: rows });
    } catch (err) {
      logger.error({ err }, `${tablePrefix}: Fehler beim Laden der ${counselorLabel}`);
      res.status(500).json({ error: `Fehler beim Laden der ${counselorLabel}` });
    }
  });

  router.post('/counselors', authMiddleware, async (req, res) => {
    try {
      const { first_name, last_name, email, salutation, room, phone, specializations,
              available_from, available_until, slot_duration_minutes, requires_confirmation } = req.body || {};

      if (!last_name?.trim()) return res.status(400).json({ error: 'Nachname ist erforderlich' });

      const { rows } = await sql`
        INSERT INTO ${sql.table(counselorsTable)}
          (first_name, last_name, email, salutation, room, phone,
           specializations, available_from, available_until, slot_duration_minutes, requires_confirmation)
        VALUES (
          ${(first_name || '').trim()},
          ${last_name.trim()},
          ${email ? email.trim().toLowerCase() : null},
          ${salutation || null},
          ${room ? room.trim() : null},
          ${phone ? phone.trim() : null},
          ${specializations || null},
          ${available_from || '08:00'},
          ${available_until || '14:00'},
          ${slot_duration_minutes || 30},
          ${requires_confirmation !== false}
        )
        RETURNING *
      `.execute(db);

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

      if (userInfo?.tempPassword) {
        res.set('Cache-Control', 'no-store');
      }
      writeAuditLog(req.user?.id, 'CREATE', counselorsTable, counselor.id, { last_name: counselor.last_name }, req.ip);
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

      const { rows } = await sql`
        UPDATE ${sql.table(counselorsTable)} SET
          first_name = ${(first_name || '').trim()},
          last_name = ${last_name.trim()},
          email = ${email ? email.trim().toLowerCase() : null},
          salutation = ${salutation || null},
          room = ${room ? room.trim() : null},
          phone = ${phone ? phone.trim() : null},
          specializations = ${specializations || null},
          available_from = ${available_from || '08:00'},
          available_until = ${available_until || '14:00'},
          slot_duration_minutes = ${slot_duration_minutes || 30},
          active = ${active !== false},
          requires_confirmation = ${requires_confirmation !== false}
        WHERE id = ${id}
        RETURNING *
      `.execute(db);

      if (!rows.length) return res.status(404).json({ error: `${counselorLabel} nicht gefunden` });

      const counselor = rows[0];
      if (counselor.user_id) {
        try {
          await db.updateTable('users')
            .set({ email: email ? email.trim().toLowerCase() : null })
            .where('id', '=', counselor.user_id)
            .execute();
        } catch (syncErr) {
          logger.warn({ err: syncErr }, 'Email sync to user failed');
        }
      }

      writeAuditLog(req.user?.id, 'UPDATE', counselorsTable, counselor.id, { last_name: counselor.last_name }, req.ip);
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

      const { rows: counselorRows } = await sql`
        SELECT user_id FROM ${sql.table(counselorsTable)} WHERE id = ${id}
      `.execute(db);
      const counselorRow = counselorRows[0];

      const { rows } = await sql`
        DELETE FROM ${sql.table(counselorsTable)} WHERE id = ${id} RETURNING id
      `.execute(db);
      if (!rows.length) return res.status(404).json({ error: `${counselorLabel} nicht gefunden` });

      if (counselorRow?.user_id && onCounselorDeleted) {
        await onCounselorDeleted(counselorRow);
      }

      writeAuditLog(req.user?.id, 'DELETE', counselorsTable, id, null, req.ip);
      res.json({ success: true });
    } catch (err) {
      if (err?.code === '23503') {
        return res.status(409).json({ error: `${counselorLabel} hat noch Termine. Bitte zuerst Termine löschen oder deaktivieren.` });
      }
      logger.error({ err }, `${tablePrefix}: Fehler beim Loeschen`);
      res.status(500).json({ error: 'Fehler beim Löschen' });
    }
  });

  // ── Stats ────────────────────────────────────────────────────────

  router.get('/stats', authMiddleware, async (_req, res) => {
    try {
      const { rows: [counts] } = await sql`
        SELECT
          (SELECT COUNT(*) FROM ${sql.table(counselorsTable)} WHERE active = TRUE) AS counselors,
          (SELECT COUNT(*) FROM ${sql.table(appointmentsTable)} WHERE status = 'requested') AS pending,
          (SELECT COUNT(*) FROM ${sql.table(appointmentsTable)} WHERE status = 'confirmed') AS confirmed,
          (SELECT COUNT(*) FROM ${sql.table(appointmentsTable)} WHERE status = 'available' AND date >= CURRENT_DATE) AS available
      `.execute(db);
      res.json({ stats: counts });
    } catch (err) {
      logger.error({ err }, `${tablePrefix}: Fehler beim Laden der Statistiken`);
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
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateFrom) || !dateRegex.test(dateUntil)
          || isNaN(new Date(dateFrom).getTime()) || isNaN(new Date(dateUntil).getTime())) {
        return res.status(400).json({ error: 'Datumsformat muss YYYY-MM-DD sein' });
      }

      const { rows } = await sql`
        SELECT a.*
        FROM ${sql.table(appointmentsTable)} a
        WHERE a.counselor_id = ${counselorId}
          AND a.date >= ${dateFrom}
          AND a.date <= ${dateUntil}
          AND a.restricted IS NOT TRUE
        ORDER BY a.date, a.time
      `.execute(db);
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
      if (ids.length > 500) {
        return res.status(400).json({ error: 'Maximal 500 IDs pro Request erlaubt' });
      }

      const numericIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (numericIds.length === 0) return res.status(400).json({ error: 'Keine gueltigen IDs' });

      // Ownership-Check + restricted-Filter: atomar im DELETE
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
      let rowCount;
      if (!isAdmin) {
        const { rows: counselorRows } = await sql`
          SELECT id FROM ${sql.table(counselorsTable)}
          WHERE user_id = ${req.user.id} AND active = true
        `.execute(db);

        if (counselorRows.length === 0) {
          return res.status(403).json({ error: 'Kein aktiver Beratungs-Account für diesen Benutzer' });
        }
        const ownCounselorId = counselorRows[0].id;
        // Atomar: Ownership + restricted-Filter direkt im DELETE
        const result = await db.deleteFrom(appointmentsTable)
          .where('id', 'in', numericIds)
          .where('counselor_id', '=', ownCounselorId)
          .where('restricted', 'is not', true)
          .executeTakeFirst();
        rowCount = Number(result?.numDeletedRows ?? 0);
      } else {
        // Admins: restricted-Termine werden nicht gelöscht
        const result = await db.deleteFrom(appointmentsTable)
          .where('id', 'in', numericIds)
          .where('restricted', 'is not', true)
          .executeTakeFirst();
        rowCount = Number(result?.numDeletedRows ?? 0);
      }
      writeAuditLog(req.user?.id, 'DELETE', appointmentsTable, null, { ids: numericIds, count: rowCount }, req.ip);
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
      const { rows } = await sql`
        SELECT * FROM ${sql.table(scheduleTable)}
        WHERE counselor_id = ${counselorId}
        ORDER BY weekday
      `.execute(db);
      res.json({ schedule: rows });
    } catch (err) {
      logger.error({ err }, `${tablePrefix}: Fehler beim Laden des Wochenplans`);
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

/**
 * Helper: create or upsert a user account for a counselor.
 */
export async function createCounselorUser(counselor, req, config) {
  const { tablePrefix, userRole, moduleKey } = config;
  const { username: reqUsername, password: reqPassword } = req.body || {};

  assertSafeIdentifier(tablePrefix, 'tablePrefix');

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
  const existingUser = await db.selectFrom('users')
    .select(['id'])
    .where('username', '=', uname)
    .executeTakeFirst();

  if (existingUser) {
    throw Object.assign(new Error('Benutzername ist bereits vergeben'), { statusCode: 409 });
  }

  const counselorsTable = `${tablePrefix}_counselors`;

  const userRow = await db.insertInto('users')
    .values({
      username: uname,
      email: parsedEmail,
      password_hash: passwordHash,
      role: userRole,
      force_password_change: true,
    })
    .returning(['id'])
    .executeTakeFirst();

  if (userRow) {
    await sql`
      UPDATE ${sql.table(counselorsTable)} SET user_id = ${userRow.id} WHERE id = ${counselor.id}
    `.execute(db);
    counselor.user_id = userRow.id;

    // Grant module access if needed
    if (moduleKey) {
      await db.insertInto('user_module_access')
        .values({ user_id: userRow.id, module_key: moduleKey })
        .onConflict((oc) => oc.doNothing())
        .execute();
    }

    return { username: uname, tempPassword };
  }
  return null;
}
