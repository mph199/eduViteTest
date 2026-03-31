import express from 'express';
import bcrypt from 'bcryptjs';
import { sql } from 'kysely';
import { requireAdmin } from '../../../middleware/auth.js';
import { db } from '../../../db/database.js';
import { normalizeAndValidateTeacherEmail, normalizeAndValidateTeacherSalutation } from '../../../utils/validators.js';
import { resolveActiveEvent } from '../../../utils/resolveActiveEvent.js';
import logger from '../../../config/logger.js';
import { validatePassword } from '../../../shared/validatePassword.js';
import { insertTeacherSlots, upsertBlCounselor, upsertSswCounselor, parseTeacherName } from './helpers.js';

const router = express.Router();

// ── POST /api/admin/teachers ────────────────────────────────────────────

router.post('/teachers', requireAdmin, async (req, res) => {
  const { email, salutation, subject, available_from, available_until, username: reqUsername, password: reqPassword } = req.body || {};

  const { firstName, lastName } = parseTeacherName(req.body || {});
  if (!lastName) return res.status(400).json({ error: 'Nachname ist erforderlich' });

  const parsedEmail = normalizeAndValidateTeacherEmail(email);
  if (!parsedEmail.ok) return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse eingeben.' });

  const parsedSalutation = normalizeAndValidateTeacherSalutation(salutation);
  if (!parsedSalutation.ok) return res.status(400).json({ error: 'Ungültige Anrede. Erlaubt: Herr, Frau, Divers.' });

  const username = (reqUsername && typeof reqUsername === 'string') ? reqUsername.trim() : '';
  if (!username) return res.status(400).json({ error: 'Benutzername ist erforderlich' });

  const tempPassword = (reqPassword && typeof reqPassword === 'string') ? reqPassword.trim() : '';
  const pwCheck = validatePassword(tempPassword);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.message });

  const availFrom = available_from || '16:00';
  const availUntil = available_until || '19:00';

  try {
    // Check username uniqueness before transaction
    const existing = await db.selectFrom('users').select('id').where('username', '=', username).executeTakeFirst();
    if (existing) {
      return res.status(409).json({ error: `Benutzername "${username}" ist bereits vergeben` });
    }

    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Transaction for teacher + user + optional counselor profiles
    const { teacher, userId } = await db.transaction().execute(async (trx) => {
      const t = await trx.insertInto('teachers')
        .values({
          first_name: firstName, last_name: lastName, email: parsedEmail.email,
          salutation: parsedSalutation.salutation, subject: subject || 'Sprechstunde',
          available_from: availFrom, available_until: availUntil,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const u = await trx.insertInto('users')
        .values({
          username, email: parsedEmail.email, password_hash: passwordHash,
          role: 'teacher', teacher_id: t.id, force_password_change: true,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      return { teacher: t, userId: u.id };
    });

    // Counselor profiles (outside transaction — non-critical, uses global db)
    if (req.body.beratungslehrer && userId) {
      await upsertBlCounselor(null, userId, req.body.beratungslehrer, {
        firstName, lastName, email: parsedEmail.email, salutation: parsedSalutation.salutation,
      });
    }
    if (req.body.schulsozialarbeit && userId) {
      await upsertSswCounselor(null, userId, req.body.schulsozialarbeit, {
        firstName, lastName, email: parsedEmail.email, salutation: parsedSalutation.salutation,
      });
    }

    const { eventId: targetEventId, eventDate } = await resolveActiveEvent();
    let slotsCreated = 0;
    try {
      slotsCreated = await insertTeacherSlots(teacher.id, availFrom, availUntil, targetEventId, eventDate);
    } catch (slotErr) {
      logger.warn({ err: slotErr }, 'Slot creation failed (teacher+user created successfully)');
    }

    res.json({
      success: true, teacher, slotsCreated,
      slotsEventId: targetEventId, slotsEventDate: eventDate,
      user: { username, passwordSet: true },
    });
  } catch (error) {
    if (error.code === '23505' && error.constraint?.includes('username')) {
      return res.status(409).json({ error: `Benutzername "${username}" ist bereits vergeben` });
    }
    logger.error({ err: error }, 'Error creating teacher');
    res.status(500).json({ error: 'Fehler beim Anlegen des Nutzers' });
  }
});

// ── GET /api/admin/teachers ─────────────────────────────────────────────

router.get('/teachers', requireAdmin, async (_req, res) => {
  try {
    const rows = await sql`
      SELECT t.*,
             bl.id AS bl_counselor_id, bl.phone AS bl_phone,
             bl.specializations AS bl_specializations,
             bl.slot_duration_minutes AS bl_slot_duration_minutes,
             bl.active AS bl_active,
             ssw.id AS ssw_counselor_id, ssw.room AS ssw_room,
             ssw.phone AS ssw_phone,
             ssw.specializations AS ssw_specializations,
             ssw.slot_duration_minutes AS ssw_slot_duration_minutes,
             ssw.requires_confirmation AS ssw_requires_confirmation,
             ssw.active AS ssw_active
      FROM teachers t
      LEFT JOIN users u ON u.teacher_id = t.id
      LEFT JOIN bl_counselors bl ON bl.user_id = u.id AND bl.active = true
      LEFT JOIN ssw_counselors ssw ON ssw.user_id = u.id AND ssw.active = true
      ORDER BY t.id
    `.execute(db);
    return res.json({ teachers: rows.rows || [] });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching admin teachers');
    return res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// ── GET /api/admin/teachers/:id/bl ──────────────────────────────────────

router.get('/teachers/:id/bl', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) return res.status(400).json({ error: 'Invalid teacher ID' });

  try {
    const counselor = await sql`
      SELECT bl.* FROM bl_counselors bl
      JOIN users u ON u.id = bl.user_id
      WHERE u.teacher_id = ${teacherId} LIMIT 1
    `.execute(db).then(r => r.rows[0] || null);

    if (!counselor) return res.json({ counselor: null, schedule: [] });

    const scheduleRows = await db.selectFrom('bl_weekly_schedule')
      .select(['id', 'counselor_id', 'weekday', 'start_time', 'end_time', 'active'])
      .where('counselor_id', '=', counselor.id)
      .orderBy('weekday')
      .execute();
    return res.json({ counselor, schedule: scheduleRows });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching BL data for teacher');
    return res.status(500).json({ error: 'Failed to fetch BL data' });
  }
});

// ── GET /api/admin/teachers/:id/ssw ────────────────────────────────────

router.get('/teachers/:id/ssw', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) return res.status(400).json({ error: 'Invalid teacher ID' });

  try {
    const counselor = await sql`
      SELECT ssw.* FROM ssw_counselors ssw
      JOIN users u ON u.id = ssw.user_id
      WHERE u.teacher_id = ${teacherId} LIMIT 1
    `.execute(db).then(r => r.rows[0] || null);

    if (!counselor) return res.json({ counselor: null, schedule: [] });

    const scheduleRows = await db.selectFrom('ssw_weekly_schedule')
      .select(['id', 'counselor_id', 'weekday', 'start_time', 'end_time', 'active'])
      .where('counselor_id', '=', counselor.id)
      .orderBy('weekday')
      .execute();
    return res.json({ counselor, schedule: scheduleRows });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching SSW data for teacher');
    return res.status(500).json({ error: 'Failed to fetch SSW data' });
  }
});

// ── PUT /api/admin/teachers/:id ─────────────────────────────────────────

router.put('/teachers/:id', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) return res.status(400).json({ error: 'Invalid teacher ID' });

  try {
    const { email, salutation, subject, available_from, available_until } = req.body || {};

    const { firstName, lastName } = parseTeacherName(req.body || {});
    if (!lastName) return res.status(400).json({ error: 'Nachname ist erforderlich' });

    const parsedEmail = normalizeAndValidateTeacherEmail(email);
    if (!parsedEmail.ok) return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse eingeben.' });

    const parsedSalutation = normalizeAndValidateTeacherSalutation(salutation);
    if (!parsedSalutation.ok) return res.status(400).json({ error: 'Ungültige Anrede. Erlaubt: Herr, Frau, Divers.' });

    const availFrom = available_from || '16:00';
    const availUntil = available_until || '19:00';

    const teacher = await db.updateTable('teachers')
      .set({
        first_name: firstName, last_name: lastName,
        email: parsedEmail.email, salutation: parsedSalutation.salutation,
        subject: subject || 'Sprechstunde',
        available_from: availFrom, available_until: availUntil,
      })
      .where('id', '=', teacherId)
      .returningAll()
      .executeTakeFirst();

    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    // Sync email to linked user account
    await db.updateTable('users')
      .set({ email: parsedEmail.email })
      .where('teacher_id', '=', teacherId)
      .execute();

    // Optional BL counselor upsert
    if (req.body.beratungslehrer !== undefined) {
      try {
        const userRow = await db.selectFrom('users').select('id').where('teacher_id', '=', teacherId).executeTakeFirst();
        if (userRow) {
          await upsertBlCounselor(null, userRow.id, req.body.beratungslehrer, {
            firstName, lastName, email: parsedEmail.email, salutation: parsedSalutation.salutation,
          });
        }
      } catch (blErr) {
        logger.warn({ err: blErr }, 'BL counselor update failed');
      }
    }

    // Optional SSW counselor upsert
    if (req.body.schulsozialarbeit !== undefined) {
      try {
        const userRow = await db.selectFrom('users').select('id').where('teacher_id', '=', teacherId).executeTakeFirst();
        if (userRow) {
          await upsertSswCounselor(null, userRow.id, req.body.schulsozialarbeit, {
            firstName, lastName, email: parsedEmail.email, salutation: parsedSalutation.salutation,
          });
        }
      } catch (sswErr) {
        logger.warn({ err: sswErr }, 'SSW counselor update failed');
      }
    }

    res.json({ success: true, teacher });
  } catch (error) {
    logger.error({ err: error }, 'Error updating teacher');
    res.status(500).json({ error: 'Failed to update teacher' });
  }
});

// ── DELETE /api/admin/teachers/:id ──────────────────────────────────────

router.delete('/teachers/:id', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) return res.status(400).json({ error: 'Invalid teacher ID' });

  try {
    await db.transaction().execute(async (trx) => {
      const bookedSlots = await trx.selectFrom('slots')
        .select(['id', 'booked'])
        .where('teacher_id', '=', teacherId)
        .execute();

      if (bookedSlots.some(s => s.booked)) {
        throw Object.assign(new Error('booked_slots'), { statusCode: 400 });
      }

      if (bookedSlots.length > 0) {
        await trx.deleteFrom('slots').where('teacher_id', '=', teacherId).execute();
      }

      const userRow = await trx.selectFrom('users')
        .select('id')
        .where('teacher_id', '=', teacherId)
        .executeTakeFirst();

      if (userRow) {
        await trx.deleteFrom('bl_counselors').where('user_id', '=', userRow.id).execute();
        await trx.deleteFrom('user_module_access')
          .where('user_id', '=', userRow.id)
          .where('module_key', '=', 'beratungslehrer')
          .execute();
        await trx.deleteFrom('ssw_counselors').where('user_id', '=', userRow.id).execute();
        await trx.deleteFrom('user_module_access')
          .where('user_id', '=', userRow.id)
          .where('module_key', '=', 'schulsozialarbeit')
          .execute();
      }

      await trx.deleteFrom('users').where('teacher_id', '=', teacherId).execute();
      await trx.deleteFrom('teachers').where('id', '=', teacherId).execute();
    });

    res.json({ success: true, message: 'Teacher deleted successfully' });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        error: 'Lehrkraft kann nicht gelöscht werden, da noch gebuchte Termine existieren. Bitte zuerst alle gebuchten Termine stornieren.',
      });
    }
    logger.error({ err: error }, 'Error deleting teacher');
    res.status(500).json({ error: 'Failed to delete teacher' });
  }
});

export default router;
