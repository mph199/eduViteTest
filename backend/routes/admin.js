import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { query } from '../config/db.js';
import { isEmailConfigured, sendMail } from '../config/email.js';
import { buildEmail, getEmailBranding } from '../emails/template.js';
import { listAdminBookings, cancelBookingAdmin } from '../services/slotsService.js';
import { mapSlotRow } from '../utils/mappers.js';
import { normalizeAndValidateTeacherEmail, normalizeAndValidateTeacherSalutation } from '../utils/validators.js';
import { generateTimeSlotsForTeacher, formatDateDE } from '../utils/timeWindows.js';

const router = express.Router();

// ── Feedback ───────────────────────────────────────────────────────────

// GET /api/admin/feedback
router.get('/feedback', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query('SELECT id, message, created_at FROM feedback ORDER BY created_at DESC LIMIT 200');
    return res.json({ feedback: rows });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// DELETE /api/admin/feedback/:id
router.delete('/feedback/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid feedback id' });
  }

  try {
    const { rows } = await query('DELETE FROM feedback WHERE id = $1 RETURNING id', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

// ── Bookings ───────────────────────────────────────────────────────────

// GET /api/admin/bookings
router.get('/bookings', requireAdmin, async (_req, res) => {
  try {
    const bookings = await listAdminBookings();
    res.json({ bookings });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// DELETE /api/admin/bookings/:slotId
router.delete('/bookings/:slotId', requireAdmin, async (req, res) => {
  const slotId = parseInt(req.params.slotId, 10);
  if (isNaN(slotId)) {
    return res.status(400).json({ error: 'Invalid slotId' });
  }

  const cancellationMessage = typeof req.body?.cancellationMessage === 'string'
    ? req.body.cancellationMessage.trim()
    : '';
  if (!cancellationMessage) {
    return res.status(400).json({ error: 'cancellationMessage is required' });
  }

  try {
    const { previous } = await cancelBookingAdmin(slotId);

    // Best-effort cancellation email (only if the booking email was verified)
    if (previous && previous.email && previous.verified_at && isEmailConfigured()) {
      try {
        const { rows: tRows } = await query('SELECT * FROM teachers WHERE id = $1', [previous.teacher_id]);
        const teacher = tRows[0] || {};
        const branding = await getEmailBranding();
        const { subject, text, html } = buildEmail('cancellation', {
          date: previous.date, time: previous.time,
          teacherName: teacher.name, teacherRoom: teacher.room,
          cancellationMessage,
        }, branding);
        await sendMail({ to: previous.email, subject, text, html });
        await query('UPDATE slots SET cancellation_sent_at = $1 WHERE id = $2', [new Date().toISOString(), slotId]);
      } catch (e) {
        console.warn('Sending cancellation email (admin) failed:', e?.message || e);
      }
    }

    res.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    const status = error?.statusCode || 500;
    res.status(status).json({ error: error?.message || 'Failed to cancel booking' });
  }
});

// ── Users ──────────────────────────────────────────────────────────────

// GET /api/admin/users
router.get('/users', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query('SELECT id, username, role, teacher_id, created_at, updated_at FROM users ORDER BY id');
    return res.json({ users: rows });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const { role } = req.body || {};
  const roleStr = String(role || '').trim();
  if (!['admin', 'teacher', 'superadmin'].includes(roleStr)) {
    return res.status(400).json({ error: 'role must be "admin", "teacher" or "superadmin"' });
  }

  // Prevent an admin from demoting themselves.
  try {
    if (req.user?.username) {
      const { rows: meRows } = await query('SELECT id, role FROM users WHERE username = $1 LIMIT 1', [req.user.username]);
      const me = meRows[0] || null;
      if (me && Number(me.id) === userId && roleStr !== 'admin') {
        return res.status(400).json({ error: 'You cannot remove your own admin role.' });
      }
    }
  } catch {
    // ignore safety check failures
  }

  try {
    const { rows } = await query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role, teacher_id, created_at, updated_at',
      [roleStr, userId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ success: true, user: rows[0] });
  } catch (error) {
    console.error('Error updating admin user role:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// ── Teachers ───────────────────────────────────────────────────────────

// POST /api/admin/teachers
router.post('/teachers', requireAdmin, async (req, res) => {
  try {
    const { name, email, salutation, subject, room, available_from, available_until, username: reqUsername, password: reqPassword } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'name required' });
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

    // Create teacher
    const { rows: newTeacherRows } = await query(
      'INSERT INTO teachers (name, email, salutation, subject, available_from, available_until, room) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name.trim(), parsedEmail.email, parsedSalutation.salutation, subject || 'Sprechstunde', availFrom, availUntil, room ? room.trim() : null]
    );
    const teacher = newTeacherRows[0];

    // Generate time slots based on teacher's available hours
    const timeSlots = generateTimeSlotsForTeacher(availFrom, availUntil);

    let targetEventId = null;
    let eventDate = null;

    try {
      const nowIso = new Date().toISOString();
      const { rows: activeEvRows } = await query(
        `SELECT id, starts_at FROM events WHERE status = 'published' AND (booking_opens_at IS NULL OR booking_opens_at <= $1) AND (booking_closes_at IS NULL OR booking_closes_at >= $1) ORDER BY starts_at DESC LIMIT 1`,
        [nowIso]
      );
      const activeEvent = activeEvRows.length ? activeEvRows[0] : null;
      if (activeEvent?.id) {
        targetEventId = activeEvent.id;
        eventDate = formatDateDE(activeEvent.starts_at);
      }
    } catch (e) {
      console.warn('Resolving active event for teacher slots failed:', e?.message || e);
    }

    if (!targetEventId || !eventDate) {
      try {
        const { rows: latestEvRows } = await query('SELECT id, starts_at FROM events ORDER BY starts_at DESC LIMIT 1');
        const latest = latestEvRows.length ? latestEvRows[0] : null;
        if (latest?.id) {
          targetEventId = latest.id;
          eventDate = formatDateDE(latest.starts_at);
        }
      } catch (e) {
        console.warn('Resolving latest event for teacher slots failed:', e?.message || e);
      }
    }

    if (!eventDate) {
      try {
        const { rows: settingsRows } = await query('SELECT event_date FROM settings LIMIT 1');
        if (settingsRows[0]?.event_date) {
          eventDate = formatDateDE(settingsRows[0].event_date);
        }
      } catch {}
    }

    if (!eventDate) {
      eventDate = formatDateDE(new Date().toISOString()) || '01.01.1970';
    }

    const now = new Date().toISOString();
    const slotsToInsert = timeSlots.map(time => ({
      teacher_id: teacher.id,
      event_id: targetEventId,
      time,
      date: eventDate,
      booked: false,
      updated_at: now,
    }));

    if (slotsToInsert.length) {
      try {
        const slotCols = Object.keys(slotsToInsert[0]);
        const valueClauses = slotsToInsert.map((_, rowIdx) =>
          `(${slotCols.map((_, colIdx) => `$${rowIdx * slotCols.length + colIdx + 1}`).join(', ')})`
        ).join(', ');
        const slotValues = slotsToInsert.flatMap(s => slotCols.map(c => s[c]));
        await query(`INSERT INTO slots (${slotCols.join(', ')}) VALUES ${valueClauses}`, slotValues);
      } catch (slotsError) {
        console.error('Error creating slots:', slotsError);
      }
    }

    // Create or upsert a linked user account for the teacher
    const baseUsername = String(reqUsername || teacher.name || `teacher${teacher.id}`)
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 20) || `teacher${teacher.id}`;

    const username = `${baseUsername}${baseUsername.endsWith(String(teacher.id)) ? '' : teacher.id}`;
    const providedPw = reqPassword && typeof reqPassword === 'string' ? reqPassword.trim() : '';
    const isStrongEnough = providedPw.length >= 8;
    const tempPassword = isStrongEnough ? providedPw : crypto.randomBytes(6).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    try {
      await query(
        `INSERT INTO users (username, password_hash, role, teacher_id) VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO UPDATE SET password_hash = $2, role = $3, teacher_id = $4`,
        [username, passwordHash, 'teacher', teacher.id]
      );
    } catch (userErr) {
      console.warn('User creation for teacher failed:', userErr?.message || userErr);
    }

    res.json({
      success: true,
      teacher,
      slotsCreated: timeSlots.length,
      slotsEventId: targetEventId,
      slotsEventDate: eventDate,
      user: { username, tempPassword }
    });
  } catch (error) {
    console.error('Error creating teacher:', error);
    res.status(500).json({ error: 'Failed to create teacher' });
  }
});

// GET /api/admin/teachers
router.get('/teachers', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM teachers ORDER BY id');
    return res.json({ teachers: rows || [] });
  } catch (error) {
    console.error('Error fetching admin teachers:', error);
    return res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// PUT /api/admin/teachers/:id
router.put('/teachers/:id', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }

  try {
    const { name, email, salutation, subject, room, available_from, available_until } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'name required' });
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
      `UPDATE teachers SET name = $1, email = $2, salutation = $3, subject = $4, available_from = $5, available_until = $6, room = $7
       WHERE id = $8 RETURNING *`,
      [name.trim(), parsedEmail.email, parsedSalutation.salutation, subject || 'Sprechstunde', availFrom, availUntil, room ? room.trim() : null, teacherId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    res.json({ success: true, teacher: rows[0] });
  } catch (error) {
    console.error('Error updating teacher:', error);
    res.status(500).json({ error: 'Failed to update teacher' });
  }
});

// PUT /api/admin/teachers/:id/reset-login
router.put('/teachers/:id/reset-login', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }

  try {
    const { rows: users } = await query('SELECT * FROM users WHERE teacher_id = $1 LIMIT 1', [teacherId]);
    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'Kein Benutzer für diese Lehrkraft gefunden' });
    }

    const user = users[0];
    const tempPassword = crypto.randomBytes(6).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);

    res.json({ success: true, user: { username: user.username, tempPassword } });
  } catch (error) {
    console.error('Error resetting teacher login:', error);
    res.status(500).json({ error: 'Failed to reset teacher login' });
  }
});

// DELETE /api/admin/teachers/:id
router.delete('/teachers/:id', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }

  try {
    const { rows: bookedSlots } = await query('SELECT id, booked FROM slots WHERE teacher_id = $1', [teacherId]);
    const hasBookedSlots = bookedSlots && bookedSlots.some(slot => slot.booked);

    if (hasBookedSlots) {
      return res.status(400).json({
        error: 'Lehrkraft kann nicht gelöscht werden, da noch gebuchte Termine existieren. Bitte zuerst alle gebuchten Termine stornieren.'
      });
    }

    if (bookedSlots && bookedSlots.length > 0) {
      await query('DELETE FROM slots WHERE teacher_id = $1', [teacherId]);
    }

    await query('DELETE FROM teachers WHERE id = $1', [teacherId]);

    res.json({ success: true, message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('Error deleting teacher:', error);
    res.status(500).json({ error: 'Failed to delete teacher' });
  }
});

// POST /api/admin/teachers/:id/generate-slots
router.post('/teachers/:id/generate-slots', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }

  try {
    const { rows: teacherRows } = await query('SELECT id, available_from, available_until FROM teachers WHERE id = $1', [teacherId]);
    const teacherRow = teacherRows[0];
    if (!teacherRow) return res.status(404).json({ error: 'Teacher not found' });

    const nowIso = new Date().toISOString();
    let targetEventId = null;
    let eventDate = null;

    try {
      const { rows: activeEvents } = await query(
        `SELECT id, starts_at FROM events
         WHERE status = 'published'
           AND (booking_opens_at IS NULL OR booking_opens_at <= $1)
           AND (booking_closes_at IS NULL OR booking_closes_at >= $1)
         ORDER BY starts_at DESC LIMIT 1`,
        [nowIso]
      );
      const activeEvent = activeEvents && activeEvents.length ? activeEvents[0] : null;
      if (activeEvent?.id) {
        targetEventId = activeEvent.id;
        eventDate = formatDateDE(activeEvent.starts_at);
      }
    } catch (e) {
      console.warn('Resolving active event for teacher slot generation failed:', e?.message || e);
    }

    if (!targetEventId || !eventDate) {
      try {
        const { rows: latestEvents } = await query('SELECT id, starts_at FROM events ORDER BY starts_at DESC LIMIT 1');
        const latest = latestEvents && latestEvents.length ? latestEvents[0] : null;
        if (latest?.id) {
          targetEventId = latest.id;
          eventDate = formatDateDE(latest.starts_at);
        }
      } catch (e) {
        console.warn('Resolving latest event for teacher slot generation failed:', e?.message || e);
      }
    }

    if (!eventDate) {
      try {
        const { rows: settingsRows } = await query('SELECT event_date FROM settings LIMIT 1');
        if (settingsRows[0]?.event_date) {
          eventDate = formatDateDE(settingsRows[0].event_date);
        }
      } catch {}
    }

    if (!eventDate) {
      eventDate = formatDateDE(new Date().toISOString()) || '01.01.1970';
    }

    const times = generateTimeSlotsForTeacher(teacherRow.available_from, teacherRow.available_until);
    const now = new Date().toISOString();

    // Avoid duplicates
    let existingConditions = 'teacher_id = $1 AND date = $2';
    let existingParams = [teacherId, eventDate];
    if (targetEventId === null) {
      existingConditions += ' AND event_id IS NULL';
    } else {
      existingConditions += ' AND event_id = $3';
      existingParams.push(targetEventId);
    }

    const { rows: existingSlots } = await query(
      `SELECT time FROM slots WHERE ${existingConditions}`,
      existingParams
    );
    const existingTimes = new Set((existingSlots || []).map((s) => s.time));

    const inserts = [];
    let skipped = 0;
    for (const time of times) {
      if (existingTimes.has(time)) {
        skipped += 1;
        continue;
      }
      inserts.push({
        teacher_id: teacherId,
        event_id: targetEventId,
        time,
        date: eventDate,
        booked: false,
        updated_at: now,
      });
    }

    if (inserts.length) {
      const values = inserts.map((ins, i) => {
        const base = i * 6;
        return `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}, $${base+6})`;
      }).join(', ');
      const flatParams = inserts.flatMap(ins => [
        ins.teacher_id, ins.event_id, ins.time, ins.date, ins.booked, ins.updated_at
      ]);
      await query(
        `INSERT INTO slots (teacher_id, event_id, time, date, booked, updated_at) VALUES ${values}`,
        flatParams
      );
    }

    return res.json({ success: true, teacherId, eventId: targetEventId, eventDate, created: inserts.length, skipped });
  } catch (error) {
    console.error('Error generating slots for teacher:', error);
    return res.status(500).json({ error: 'Failed to generate slots for teacher' });
  }
});

// ── Settings ───────────────────────────────────────────────────────────

// GET /api/admin/settings
router.get('/settings', requireAuth, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM settings LIMIT 1');
    const data = rows[0] || null;

    if (!data) {
      return res.json({
        id: 1,
        event_name: 'Elternsprechtag',
        event_date: new Date().toISOString().split('T')[0]
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/admin/settings
router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const { event_name, event_date } = req.body || {};

    if (!event_name || !event_date) {
      return res.status(400).json({ error: 'event_name and event_date required' });
    }

    const { rows } = await query(
      `INSERT INTO settings (id, event_name, event_date, updated_at) VALUES (1, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET event_name = $1, event_date = $2, updated_at = $3
       RETURNING *`,
      [event_name.trim(), event_date, new Date().toISOString()]
    );

    res.json({ success: true, settings: rows[0] });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ── Slots ──────────────────────────────────────────────────────────────

// GET /api/admin/slots
router.get('/slots', requireAdmin, async (req, res) => {
  try {
    const { teacherId, eventId, booked, limit } = req.query;

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (teacherId !== undefined) {
      const teacherIdNum = parseInt(String(teacherId), 10);
      if (isNaN(teacherIdNum)) {
        return res.status(400).json({ error: 'teacherId must be a number' });
      }
      conditions.push(`teacher_id = $${paramIdx++}`);
      params.push(teacherIdNum);
    }

    if (eventId !== undefined) {
      const raw = String(eventId);
      if (raw === 'null') {
        conditions.push('event_id IS NULL');
      } else {
        const eventIdNum = parseInt(raw, 10);
        if (isNaN(eventIdNum)) {
          return res.status(400).json({ error: 'eventId must be a number or "null"' });
        }
        conditions.push(`event_id = $${paramIdx++}`);
        params.push(eventIdNum);
      }
    }

    if (booked !== undefined) {
      const raw = String(booked).toLowerCase();
      if (raw !== 'true' && raw !== 'false') {
        return res.status(400).json({ error: 'booked must be "true" or "false"' });
      }
      conditions.push(`booked = $${paramIdx++}`);
      params.push(raw === 'true');
    }

    const limitNum = limit !== undefined ? parseInt(String(limit), 10) : 2000;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 10000) {
      return res.status(400).json({ error: 'limit must be between 1 and 10000' });
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT * FROM slots ${whereClause} ORDER BY date, time LIMIT $${paramIdx}`,
      [...params, limitNum]
    );

    return res.json({ slots: (rows || []).map(mapSlotRow) });
  } catch (error) {
    console.error('Error fetching admin slots:', error);
    return res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// POST /api/admin/slots
router.post('/slots', requireAdmin, async (req, res) => {
  try {
    const { teacher_id, time, date } = req.body || {};

    if (!teacher_id || !time || !date) {
      return res.status(400).json({ error: 'teacher_id, time, and date required' });
    }

    const { rows } = await query(
      `INSERT INTO slots (teacher_id, time, date, booked) VALUES ($1, $2, $3, false) RETURNING *`,
      [teacher_id, time.trim(), date.trim()]
    );

    res.json({ success: true, slot: rows[0] });
  } catch (error) {
    console.error('Error creating slot:', error);
    res.status(500).json({ error: 'Failed to create slot' });
  }
});

// PUT /api/admin/slots/:id
router.put('/slots/:id', requireAdmin, async (req, res) => {
  const slotId = parseInt(req.params.id, 10);
  if (isNaN(slotId)) {
    return res.status(400).json({ error: 'Invalid slot ID' });
  }

  try {
    const { time, date } = req.body || {};

    if (!time || !date) {
      return res.status(400).json({ error: 'time and date required' });
    }

    const { rows } = await query(
      `UPDATE slots SET time = $1, date = $2, updated_at = $3 WHERE id = $4 RETURNING *`,
      [time.trim(), date.trim(), new Date().toISOString(), slotId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    res.json({ success: true, slot: rows[0] });
  } catch (error) {
    console.error('Error updating slot:', error);
    res.status(500).json({ error: 'Failed to update slot' });
  }
});

// DELETE /api/admin/slots/:id
router.delete('/slots/:id', requireAdmin, async (req, res) => {
  const slotId = parseInt(req.params.id, 10);
  if (isNaN(slotId)) {
    return res.status(400).json({ error: 'Invalid slot ID' });
  }

  try {
    await query('DELETE FROM slots WHERE id = $1', [slotId]);
    res.json({ success: true, message: 'Slot deleted successfully' });
  } catch (error) {
    console.error('Error deleting slot:', error);
    res.status(500).json({ error: 'Failed to delete slot' });
  }
});

// ── Events ─────────────────────────────────────────────────────────────

// GET /api/admin/events
router.get('/events', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM events ORDER BY starts_at DESC');
    res.json({ events: rows || [] });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// POST /api/admin/events
router.post('/events', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, school_year, starts_at, ends_at, timezone, booking_opens_at, booking_closes_at, status } = req.body || {};
    if (!name || !school_year || !starts_at || !ends_at) {
      return res.status(400).json({ error: 'name, school_year, starts_at, ends_at required' });
    }

    const { rows } = await query(
      `INSERT INTO events (name, school_year, starts_at, ends_at, timezone, status, booking_opens_at, booking_closes_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, school_year, starts_at, ends_at, timezone || 'Europe/Berlin', status || 'draft', booking_opens_at || null, booking_closes_at || null, new Date().toISOString()]
    );
    res.json({ success: true, event: rows[0] });
  } catch (error) {
    console.error('Error creating event:', error);
    const message = (error && typeof error === 'object' && 'message' in error)
      ? String(error.message)
      : 'Failed to create event';

    if (message.toLowerCase().includes('row-level security')) {
      return res.status(403).json({ error: 'RLS blocked insert on events', message });
    }

    return res.status(500).json({ error: 'Failed to create event', message });
  }
});

// PUT /api/admin/events/:id
router.put('/events/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const patch = { ...(req.body || {}), updated_at: new Date().toISOString() };
    const setCols = [];
    const setParams = [];
    let pi = 1;
    for (const [key, val] of Object.entries(patch)) {
      if (key === 'id') continue;
      setCols.push(`${key} = $${pi++}`);
      setParams.push(val);
    }
    if (!setCols.length) return res.status(400).json({ error: 'No fields to update' });
    setParams.push(id);
    const { rows } = await query(
      `UPDATE events SET ${setCols.join(', ')} WHERE id = $${pi} RETURNING *`,
      setParams
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true, event: rows[0] });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /api/admin/events/:id
router.delete('/events/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await query('DELETE FROM events WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// GET /api/admin/events/:id/stats
router.get('/events/:id/stats', requireAuth, requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const { rows: eventRows } = await query('SELECT id FROM events WHERE id = $1', [eventId]);
    if (!eventRows.length) return res.status(404).json({ error: 'Event not found' });

    const [totalRes, availableRes, bookedRes, reservedRes, confirmedRes] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM slots WHERE event_id = $1', [eventId]),
      query('SELECT COUNT(*) AS count FROM slots WHERE event_id = $1 AND booked = false', [eventId]),
      query('SELECT COUNT(*) AS count FROM slots WHERE event_id = $1 AND booked = true', [eventId]),
      query(`SELECT COUNT(*) AS count FROM slots WHERE event_id = $1 AND status = 'reserved'`, [eventId]),
      query(`SELECT COUNT(*) AS count FROM slots WHERE event_id = $1 AND status = 'confirmed'`, [eventId]),
    ]);

    res.json({
      eventId,
      totalSlots: parseInt(totalRes.rows[0].count, 10) || 0,
      availableSlots: parseInt(availableRes.rows[0].count, 10) || 0,
      bookedSlots: parseInt(bookedRes.rows[0].count, 10) || 0,
      reservedSlots: parseInt(reservedRes.rows[0].count, 10) || 0,
      confirmedSlots: parseInt(confirmedRes.rows[0].count, 10) || 0,
    });
  } catch (error) {
    console.error('Error fetching event stats:', error);
    res.status(500).json({ error: 'Failed to fetch event stats' });
  }
});

// POST /api/admin/events/:id/generate-slots
router.post('/events/:id/generate-slots', requireAuth, requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid id' });

  const { dryRun, replaceExisting, slotMinutes: rawSlotMinutes } = req.body || {};
  const slotMinutes = [10, 15, 20, 30].includes(rawSlotMinutes) ? rawSlotMinutes : 15;

  try {
    const { rows: evtRows } = await query('SELECT * FROM events WHERE id = $1', [eventId]);
    const eventRow = evtRows[0];
    if (!eventRow) return res.status(404).json({ error: 'Event not found' });

    const eventDate = formatDateDE(eventRow.starts_at);
    if (!eventDate) return res.status(400).json({ error: 'Event starts_at is invalid' });

    if (replaceExisting && !dryRun) {
      await query('DELETE FROM slots WHERE event_id = $1 AND date = $2', [eventId, eventDate]);
    }

    const { rows: teachers } = await query('SELECT id, available_from, available_until FROM teachers');
    const teacherRows = teachers || [];
    if (!teacherRows.length) return res.json({ success: true, created: 0, skipped: 0, eventDate });

    let created = 0;
    let skipped = 0;

    for (const t of teacherRows) {
      const times = generateTimeSlotsForTeacher(t.available_from, t.available_until, slotMinutes);

      const { rows: existingSlots } = await query(
        'SELECT time FROM slots WHERE teacher_id = $1 AND event_id = $2 AND date = $3',
        [t.id, eventId, eventDate]
      );
      const existingTimes = new Set((existingSlots || []).map((s) => s.time));

      const inserts = [];
      for (const time of times) {
        if (existingTimes.has(time)) {
          skipped += 1;
          continue;
        }
        inserts.push({
          teacher_id: t.id,
          event_id: eventId,
          date: eventDate,
          time,
          booked: false,
          updated_at: new Date().toISOString(),
        });
      }

      if (inserts.length) {
        if (!dryRun) {
          const values = inserts.map((ins, i) => {
            const base = i * 6;
            return `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}, $${base+6})`;
          }).join(', ');
          const flatParams = inserts.flatMap(ins => [
            ins.teacher_id, ins.event_id, ins.date, ins.time, ins.booked, ins.updated_at
          ]);
          await query(
            `INSERT INTO slots (teacher_id, event_id, date, time, booked, updated_at) VALUES ${values}`,
            flatParams
          );
        }
        created += inserts.length;
      }
    }

    return res.json({ success: true, eventId, eventDate, created, skipped, dryRun: Boolean(dryRun), replaceExisting: Boolean(replaceExisting) });
  } catch (error) {
    console.error('Error generating slots for event:', error);
    return res.status(500).json({ error: 'Failed to generate slots for event' });
  }
});

export default router;
