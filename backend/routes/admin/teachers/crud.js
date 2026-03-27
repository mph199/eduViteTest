import express from 'express';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../../../middleware/auth.js';
import { query, getClient } from '../../../config/db.js';
import { normalizeAndValidateTeacherEmail, normalizeAndValidateTeacherSalutation } from '../../../utils/validators.js';
import { resolveActiveEvent } from '../../../utils/resolveActiveEvent.js';
import logger from '../../../config/logger.js';
import { validatePassword } from '../../../shared/validatePassword.js';
import { insertTeacherSlots, upsertBlCounselor, upsertSswCounselor } from './helpers.js';

const router = express.Router();

// ── POST /api/admin/teachers ────────────────────────────────────────────

router.post('/teachers', requireAdmin, async (req, res) => {
  const { first_name, last_name, name, email, salutation, subject, available_from, available_until, username: reqUsername, password: reqPassword } = req.body || {};

  // Support both new (first_name/last_name) and legacy (name) field
  let firstName = (first_name || '').trim();
  let lastName  = (last_name  || '').trim();
  if (!firstName && !lastName && name) {
    const parts = String(name).trim().split(/\s+/);
    lastName  = parts.pop() || '';
    firstName = parts.join(' ');
  }
  if (!lastName) {
    return res.status(400).json({ error: 'Nachname ist erforderlich' });
  }

  const parsedEmail = normalizeAndValidateTeacherEmail(email);
  if (!parsedEmail.ok) {
    return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse eingeben.' });
  }

  const parsedSalutation = normalizeAndValidateTeacherSalutation(salutation);
  if (!parsedSalutation.ok) {
    return res.status(400).json({ error: 'Ungültige Anrede. Erlaubt: Herr, Frau, Divers.' });
  }

  // Username + password are required
  const username = (reqUsername && typeof reqUsername === 'string') ? reqUsername.trim() : '';
  if (!username) {
    return res.status(400).json({ error: 'Benutzername ist erforderlich' });
  }

  const tempPassword = (reqPassword && typeof reqPassword === 'string') ? reqPassword.trim() : '';
  const pwCheck = validatePassword(tempPassword);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.message });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Check for duplicate username inside the transaction
    const { rows: existingUser } = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Benutzername "${username}" ist bereits vergeben` });
    }

    const availFrom = available_from || '16:00';
    const availUntil = available_until || '19:00';

    // Create teacher
    const { rows: newTeacherRows } = await client.query(
      'INSERT INTO teachers (first_name, last_name, email, salutation, subject, available_from, available_until) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [firstName, lastName, parsedEmail.email, parsedSalutation.salutation, subject || 'Sprechstunde', availFrom, availUntil]
    );
    const teacher = newTeacherRows[0];

    // Create linked user account (no ON CONFLICT – duplicates are rejected)
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const { rows: userRows } = await client.query(
      'INSERT INTO users (username, email, password_hash, role, teacher_id, force_password_change) VALUES ($1, $2, $3, $4, $5, true) RETURNING id',
      [username, parsedEmail.email, passwordHash, 'teacher', teacher.id]
    );
    const userId = userRows[0]?.id ?? null;

    // Optional: Beratungslehrer-Profil anlegen
    const blData = req.body.beratungslehrer;
    if (blData && userId) {
      await upsertBlCounselor(client, userId, blData, {
        firstName, lastName, email: parsedEmail.email, salutation: parsedSalutation.salutation,
      });
    }

    // Optional: SSW-Berater-Profil anlegen
    const sswData = req.body.schulsozialarbeit;
    if (sswData && userId) {
      await upsertSswCounselor(client, userId, sswData, {
        firstName, lastName, email: parsedEmail.email, salutation: parsedSalutation.salutation,
      });
    }

    await client.query('COMMIT');

    // Generate time slots outside transaction (non-critical, can fail independently)
    const { eventId: targetEventId, eventDate } = await resolveActiveEvent();
    let slotsCreated = 0;
    try {
      slotsCreated = await insertTeacherSlots(teacher.id, availFrom, availUntil, targetEventId, eventDate);
    } catch (slotErr) {
      logger.warn({ err: slotErr }, 'Slot creation failed (teacher+user created successfully)');
    }

    res.json({
      success: true,
      teacher,
      slotsCreated,
      slotsEventId: targetEventId,
      slotsEventDate: eventDate,
      user: { username, passwordSet: true }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    // UNIQUE constraint violation (race condition)
    if (error.code === '23505' && error.constraint?.includes('username')) {
      return res.status(409).json({ error: `Benutzername "${username}" ist bereits vergeben` });
    }
    logger.error({ err: error }, 'Error creating teacher');
    res.status(500).json({ error: 'Fehler beim Anlegen des Nutzers' });
  } finally {
    client.release();
  }
});

// ── GET /api/admin/teachers ─────────────────────────────────────────────

router.get('/teachers', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT t.*,
             bl.id AS bl_counselor_id,
             bl.phone AS bl_phone,
             bl.specializations AS bl_specializations,
             bl.slot_duration_minutes AS bl_slot_duration_minutes,
             bl.active AS bl_active
      FROM teachers t
      LEFT JOIN users u ON u.teacher_id = t.id
      LEFT JOIN bl_counselors bl ON bl.user_id = u.id AND bl.active = true
      ORDER BY t.id
    `);
    return res.json({ teachers: rows || [] });
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
    const { rows: blRows } = await query(
      `SELECT bl.* FROM bl_counselors bl
       JOIN users u ON u.id = bl.user_id
       WHERE u.teacher_id = $1 LIMIT 1`,
      [teacherId]
    );
    if (!blRows.length) return res.json({ counselor: null, schedule: [] });

    const counselor = blRows[0];
    const { rows: scheduleRows } = await query(
      'SELECT id, counselor_id, weekday, start_time, end_time, active FROM bl_weekly_schedule WHERE counselor_id = $1 ORDER BY weekday',
      [counselor.id]
    );
    return res.json({ counselor, schedule: scheduleRows });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching BL data for teacher');
    return res.status(500).json({ error: 'Failed to fetch BL data' });
  }
});

// ── PUT /api/admin/teachers/:id ─────────────────────────────────────────

router.put('/teachers/:id', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }

  try {
    const { first_name, last_name, name, email, salutation, subject, available_from, available_until } = req.body || {};

    let firstName = (first_name || '').trim();
    let lastName  = (last_name  || '').trim();
    if (!firstName && !lastName && name) {
      const parts = String(name).trim().split(/\s+/);
      lastName  = parts.pop() || '';
      firstName = parts.join(' ');
    }
    if (!lastName) {
      return res.status(400).json({ error: 'Nachname ist erforderlich' });
    }

    const parsedEmail = normalizeAndValidateTeacherEmail(email);
    if (!parsedEmail.ok) {
      return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse eingeben.' });
    }

    const parsedSalutation = normalizeAndValidateTeacherSalutation(salutation);
    if (!parsedSalutation.ok) {
      return res.status(400).json({ error: 'Ungültige Anrede. Erlaubt: Herr, Frau, Divers.' });
    }

    const availFrom = available_from || '16:00';
    const availUntil = available_until || '19:00';

    const { rows } = await query(
      `UPDATE teachers SET first_name = $1, last_name = $2, email = $3, salutation = $4, subject = $5, available_from = $6, available_until = $7
       WHERE id = $8 RETURNING *`,
      [firstName, lastName, parsedEmail.email, parsedSalutation.salutation, subject || 'Sprechstunde', availFrom, availUntil, teacherId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    // Sync email to linked user account
    await query(
      'UPDATE users SET email = $1 WHERE teacher_id = $2',
      [parsedEmail.email, teacherId]
    );

    // Optional: Beratungslehrer-Profil anlegen/aktualisieren/deaktivieren
    const blData = req.body.beratungslehrer;
    if (blData !== undefined) {
      try {
        const { rows: userRows } = await query('SELECT id FROM users WHERE teacher_id = $1 LIMIT 1', [teacherId]);
        const userId = userRows[0]?.id;
        if (userId) {
          await upsertBlCounselor(query, userId, blData, {
            firstName, lastName, email: parsedEmail.email, salutation: parsedSalutation.salutation,
          });
        }
      } catch (blErr) {
        logger.warn({ err: blErr }, 'BL counselor update failed');
      }
    }

    // Optional: SSW-Berater-Profil anlegen/aktualisieren/deaktivieren
    const sswData = req.body.schulsozialarbeit;
    if (sswData !== undefined) {
      try {
        const { rows: userRows } = await query('SELECT id FROM users WHERE teacher_id = $1 LIMIT 1', [teacherId]);
        const userId = userRows[0]?.id;
        if (userId) {
          await upsertSswCounselor(query, userId, sswData, {
            firstName, lastName, email: parsedEmail.email, salutation: parsedSalutation.salutation,
          });
        }
      } catch (sswErr) {
        logger.warn({ err: sswErr }, 'SSW counselor update failed');
      }
    }

    res.json({ success: true, teacher: rows[0] });
  } catch (error) {
    logger.error({ err: error }, 'Error updating teacher');
    res.status(500).json({ error: 'Failed to update teacher' });
  }
});

// ── DELETE /api/admin/teachers/:id ──────────────────────────────────────

router.delete('/teachers/:id', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: bookedSlots } = await client.query('SELECT id, booked FROM slots WHERE teacher_id = $1', [teacherId]);
    const hasBookedSlots = bookedSlots && bookedSlots.some(slot => slot.booked);

    if (hasBookedSlots) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        error: 'Lehrkraft kann nicht gelöscht werden, da noch gebuchte Termine existieren. Bitte zuerst alle gebuchten Termine stornieren.'
      });
    }

    if (bookedSlots && bookedSlots.length > 0) {
      await client.query('DELETE FROM slots WHERE teacher_id = $1', [teacherId]);
    }

    // Find the user linked to this teacher so we can clean up counselor profiles
    const { rows: userRows } = await client.query('SELECT id FROM users WHERE teacher_id = $1', [teacherId]);
    const userId = userRows[0]?.id;

    // Delete BL counselor profile (if any) before deleting the user,
    // preventing ghost entries from ON DELETE SET NULL
    if (userId) {
      await client.query('DELETE FROM bl_counselors WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM user_module_access WHERE user_id = $1 AND module_key = $2', [userId, 'beratungslehrer']);
      await client.query('DELETE FROM ssw_counselors WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM user_module_access WHERE user_id = $1 AND module_key = $2', [userId, 'schulsozialarbeit']);
    }

    await client.query('DELETE FROM users WHERE teacher_id = $1', [teacherId]);
    await client.query('DELETE FROM teachers WHERE id = $1', [teacherId]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Teacher deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ err: error }, 'Error deleting teacher');
    res.status(500).json({ error: 'Failed to delete teacher' });
  } finally {
    client.release();
  }
});

export default router;
