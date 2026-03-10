import express from 'express';
import crypto from 'crypto';
import { query } from '../config/db.js';
import { isEmailConfigured, sendMail, getLastEmailDebugInfo } from '../config/email.js';
import { buildEmail, getEmailBranding } from '../emails/template.js';
import { listTeachers } from '../services/teachersService.js';
import { reserveBooking, verifyBookingToken } from '../services/slotsService.js';
import { mapSlotRow } from '../utils/mappers.js';
import { getRequestedTimeWindowsForSystem, formatDateDE } from '../utils/timeWindows.js';

const router = express.Router();

// ── Helpers ────────────────────────────────────────────────────────────

async function verifyBookingRequestToken(token) {
  if (!token || typeof token !== 'string') {
    const err = new Error('Ungültiger oder abgelaufener Link');
    err.statusCode = 404;
    throw err;
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows } = await query(
    `SELECT * FROM booking_requests WHERE status = 'requested' AND verification_token_hash = $1`,
    [tokenHash]
  );
  const reqRow = rows[0] || null;

  if (!reqRow) {
    const err = new Error('Ungültiger oder abgelaufener Link');
    err.statusCode = 404;
    throw err;
  }

  // Idempotent verify
  if (reqRow.verified_at) {
    return { requestRow: reqRow, verifiedAt: reqRow.verified_at };
  }

  const ttlHoursRaw = process.env.VERIFICATION_TOKEN_TTL_HOURS;
  const ttlHours = Number.parseInt(ttlHoursRaw || '72', 10);
  const ttlMs = (Number.isFinite(ttlHours) ? ttlHours : 72) * 60 * 60 * 1000;

  if (reqRow.verification_sent_at) {
    const sentAt = new Date(reqRow.verification_sent_at);
    if (!Number.isNaN(sentAt.getTime())) {
      const ageMs = Date.now() - sentAt.getTime();
      if (ageMs > ttlMs) {
        const err = new Error('Link abgelaufen. Bitte senden Sie Ihre Anfrage erneut.');
        err.statusCode = 410;
        throw err;
      }
    }
  }

  const now = new Date().toISOString();
  await query(
    `UPDATE booking_requests SET verified_at = $1, verification_token_hash = NULL, updated_at = $1 WHERE id = $2`,
    [now, reqRow.id]
  );

  return {
    requestRow: { ...reqRow, verified_at: now, verification_token_hash: null },
    verifiedAt: now,
  };
}

// ── Dev helper ─────────────────────────────────────────────────────────

router.get('/dev/email/last', (req, res) => {
  const transport = (process.env.MAIL_TRANSPORT || '').trim().toLowerCase();
  const allow = transport === 'ethereal' && process.env.NODE_ENV !== 'production';
  if (!allow) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.json({ email: getLastEmailDebugInfo() });
});

// ── GET /api/teachers ──────────────────────────────────────────────────

router.get('/teachers', async (_req, res) => {
  try {
    const teachers = await listTeachers();
    res.json({ teachers });
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// ── GET /api/slots?teacherId=1 ────────────────────────────────────────

router.get('/slots', async (req, res) => {
  try {
    const { teacherId, eventId } = req.query;
    if (!teacherId) {
      return res.status(400).json({ error: 'teacherId query param required' });
    }
    const teacherIdNum = parseInt(teacherId, 10);
    if (isNaN(teacherIdNum)) {
      return res.status(400).json({ error: 'teacherId must be a number' });
    }

    const { rows: teacherRows } = await query('SELECT id, system FROM teachers WHERE id = $1', [teacherIdNum]);
    const teacherRow = teacherRows[0] || null;
    if (!teacherRow) throw new Error('Teacher not found');

    // Resolve event scope: explicit eventId OR active published event
    let resolvedEventId = null;
    let resolvedEventStartsAt = null;
    if (eventId !== undefined) {
      const parsed = parseInt(String(eventId), 10);
      if (isNaN(parsed)) {
        return res.status(400).json({ error: 'eventId must be a number' });
      }
      resolvedEventId = parsed;
      try {
        const { rows: evRows } = await query('SELECT id, starts_at FROM events WHERE id = $1', [resolvedEventId]);
        const ev = evRows[0] || null;
        resolvedEventStartsAt = ev?.starts_at || null;
      } catch {
        resolvedEventStartsAt = null;
      }
    } else {
      const now = new Date().toISOString();
      const { rows: activeRows } = await query(
        `SELECT id, starts_at FROM events WHERE status = 'published' AND (booking_opens_at IS NULL OR booking_opens_at <= $1) AND (booking_closes_at IS NULL OR booking_closes_at >= $1) ORDER BY starts_at DESC LIMIT 1`,
        [now]
      );
      resolvedEventId = activeRows.length ? activeRows[0].id : null;
      resolvedEventStartsAt = activeRows.length ? activeRows[0].starts_at : null;
    }

    const teacherSystem = teacherRow?.system || 'dual';
    const times = getRequestedTimeWindowsForSystem(teacherSystem);
    const eventDate = formatDateDE(resolvedEventStartsAt || new Date().toISOString()) || '01.01.1970';

    // Privacy: do not expose booking occupancy or visitor details on public endpoints.
    const publicSlots = times.map((time, idx) => ({
      id: idx + 1,
      eventId: resolvedEventId ?? undefined,
      teacherId: teacherIdNum,
      time,
      date: eventDate,
      booked: false,
    }));

    return res.json({ slots: publicSlots });
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// ── POST /api/bookings ─────────────────────────────────────────────────

router.post('/bookings', async (req, res) => {
  try {
    const payload = req.body || {};

    // Require active published event before accepting booking requests
    const nowIso = new Date().toISOString();
    const { rows: activeEventRows } = await query(
      `SELECT id FROM events WHERE status = 'published' AND (booking_opens_at IS NULL OR booking_opens_at <= $1) AND (booking_closes_at IS NULL OR booking_closes_at >= $1) ORDER BY starts_at DESC LIMIT 1`,
      [nowIso]
    );
    const activeEventId = activeEventRows.length ? activeEventRows[0].id : null;
    if (!activeEventId) {
      return res.status(409).json({ error: 'Buchungen sind aktuell nicht freigegeben' });
    }

    const { slotRow, verificationToken } = await reserveBooking(payload);

    // If the slot is linked to an event, enforce it matches active event
    if (slotRow?.event_id && slotRow.event_id !== activeEventId) {
      return res.status(409).json({ error: 'Dieser Termin gehört nicht zum aktuell freigegebenen Elternsprechtag' });
    }

    // Send verification email (best-effort)
    if (slotRow && isEmailConfigured()) {
      const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
      const verifyUrl = `${baseUrl}/verify?token=${verificationToken}`;
      const { rows: teacherLookupRows } = await query('SELECT * FROM teachers WHERE id = $1', [slotRow.teacher_id]);
      const teacher = teacherLookupRows[0] || {};
      try {
        const branding = await getEmailBranding();
        const { subject, text, html } = buildEmail('verify-slot', {
          date: slotRow.date, time: slotRow.time,
          teacherName: teacher.name, teacherRoom: teacher.room, verifyUrl,
        }, branding);
        await sendMail({ to: payload.email, subject, text, html });
      } catch (e) {
        console.warn('Sending verification email failed:', e?.message || e);
      }
    }

    res.json({ success: true, updatedSlot: mapSlotRow(slotRow) });
  } catch (error) {
    console.error('Error creating booking:', error);
    const status = error?.statusCode || 500;
    res.status(status).json({ error: error?.message || 'Failed to create booking' });
  }
});

// ── POST /api/booking-requests ─────────────────────────────────────────

router.post('/booking-requests', async (req, res) => {
  try {
    const payload = req.body || {};

    // Require active published event
    const nowIso = new Date().toISOString();
    const { rows: activeEventRows } = await query(
      `SELECT id, starts_at FROM events WHERE status = 'published' AND (booking_opens_at IS NULL OR booking_opens_at <= $1) AND (booking_closes_at IS NULL OR booking_closes_at >= $1) ORDER BY starts_at DESC LIMIT 1`,
      [nowIso]
    );
    const activeEvent = activeEventRows.length ? activeEventRows[0] : null;
    const activeEventId = activeEvent?.id || null;
    if (!activeEventId) {
      return res.status(409).json({ error: 'Buchungen sind aktuell nicht freigegeben' });
    }

    const teacherIdNum = parseInt(String(payload.teacherId || ''), 10);
    if (!teacherIdNum || isNaN(teacherIdNum)) {
      return res.status(400).json({ error: 'teacherId required' });
    }

    const { rows: teacherLookupRows2 } = await query('SELECT id, system FROM teachers WHERE id = $1', [teacherIdNum]);
    const teacherRow = teacherLookupRows2[0] || null;
    if (!teacherRow) throw new Error('Teacher not found');

    const requestedTime = typeof payload.requestedTime === 'string' ? payload.requestedTime.trim() : '';
    const allowedTimes = getRequestedTimeWindowsForSystem(teacherRow?.system || 'dual');
    if (!allowedTimes.includes(requestedTime)) {
      return res.status(400).json({ error: 'requestedTime invalid' });
    }

    const visitorType = payload.visitorType;
    const className = typeof payload.className === 'string' ? payload.className.trim() : '';
    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';

    if (!visitorType || !className || !email) {
      return res.status(400).json({ error: 'visitorType, className, email required' });
    }

    const normalize = (v) => (typeof v === 'string' ? v.trim() : '');

    if (visitorType === 'parent') {
      const parentName = normalize(payload.parentName);
      const studentName = normalize(payload.studentName);
      if (!parentName || !studentName) {
        return res.status(400).json({ error: 'parentName and studentName required for parent type' });
      }
    } else if (visitorType === 'company') {
      const companyName = normalize(payload.companyName);
      const traineeName = normalize(payload.traineeName);
      const representativeName = normalize(payload.representativeName);
      if (!companyName || !traineeName || !representativeName) {
        return res.status(400).json({ error: 'companyName, traineeName and representativeName required for company type' });
      }
    } else {
      return res.status(400).json({ error: 'visitorType must be parent or company' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const now = new Date().toISOString();
    const eventDate = formatDateDE(activeEvent.starts_at) || formatDateDE(now) || '01.01.1970';

    const insert = {
      event_id: activeEventId,
      teacher_id: teacherIdNum,
      requested_time: requestedTime,
      date: eventDate,
      status: 'requested',
      visitor_type: visitorType,
      class_name: className,
      email,
      message: message || null,
      verification_token_hash: verificationTokenHash,
      verification_sent_at: now,
      verified_at: null,
      confirmation_sent_at: null,
      assigned_slot_id: null,
      updated_at: now,
    };

    if (visitorType === 'parent') {
      insert.parent_name = normalize(payload.parentName);
      insert.student_name = normalize(payload.studentName);
      insert.company_name = null;
      insert.trainee_name = null;
      insert.representative_name = null;
    } else {
      insert.company_name = normalize(payload.companyName);
      insert.trainee_name = normalize(payload.traineeName);
      insert.representative_name = normalize(payload.representativeName);
      insert.parent_name = null;
      insert.student_name = null;
    }

    const insertKeys = Object.keys(insert);
    const insertValues = Object.values(insert);
    const insertPlaceholders = insertKeys.map((_, i) => `$${i + 1}`).join(', ');
    const insertColumns = insertKeys.join(', ');
    const { rows: createdRows } = await query(
      `INSERT INTO booking_requests (${insertColumns}) VALUES (${insertPlaceholders}) RETURNING *`,
      insertValues
    );
    const created = createdRows[0] || null;

    // Send verification email (best-effort)
    if (created && isEmailConfigured()) {
      const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
      const verifyUrl = `${baseUrl}/verify?token=${verificationToken}`;
      const { rows: teacherEmailRows } = await query('SELECT * FROM teachers WHERE id = $1', [teacherIdNum]);
      const teacher = teacherEmailRows[0] || {};
      try {
        const branding = await getEmailBranding();
        const { subject, text, html } = buildEmail('verify-request', {
          date: created.date, requestedTime: created.requested_time,
          teacherName: teacher.name, teacherRoom: teacher.room, verifyUrl,
        }, branding);
        await sendMail({ to: email, subject, text, html });
      } catch (e) {
        console.warn('Sending verification email (request) failed:', e?.message || e);
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error creating booking request:', error);
    return res.status(500).json({ error: 'Failed to create booking request' });
  }
});

// ── GET /api/bookings/verify/:token ────────────────────────────────────

router.get('/bookings/verify/:token', async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  try {
    let slot = null;
    let request = null;
    let now = new Date().toISOString();

    try {
      const verifiedSlot = await verifyBookingToken(token);
      slot = verifiedSlot.slotRow;
      now = verifiedSlot.verifiedAt;
    } catch (e) {
      if (e?.statusCode !== 404) throw e;
      const verifiedReq = await verifyBookingRequestToken(token);
      request = verifiedReq.requestRow;
      now = verifiedReq.verifiedAt;
    }

    // Legacy slot verification path
    if (slot) {
      if (slot.status === 'confirmed' && !slot.confirmation_sent_at && isEmailConfigured()) {
        try {
          const { rows: tRows } = await query('SELECT * FROM teachers WHERE id = $1', [slot.teacher_id]);
          const teacher = tRows[0] || {};
          const branding = await getEmailBranding();
          const { subject, text, html } = buildEmail('confirmation', {
            date: slot.date, time: slot.time,
            teacherName: teacher.name, teacherRoom: teacher.room,
            label: 'Ihre Terminbuchung wurde durch die Lehrkraft bestätigt.',
          }, branding);
          await sendMail({ to: slot.email, subject, text, html });
          await query('UPDATE slots SET confirmation_sent_at = $1, updated_at = $1 WHERE id = $2', [now, slot.id]);
        } catch (e) {
          console.warn('Sending confirmation after verify failed:', e?.message || e);
        }
      }
      return res.json({ success: true, message: 'E-Mail bestätigt. Wir informieren Sie bei Bestätigung durch die Lehrkraft.' });
    }

    // Booking request verification path
    if (request) {
      if (request.status === 'accepted' && request.assigned_slot_id && !request.confirmation_sent_at && isEmailConfigured()) {
        try {
          const { rows: slotLookupRows } = await query('SELECT * FROM slots WHERE id = $1', [request.assigned_slot_id]);
          const slotRow = slotLookupRows[0] || null;
          const { rows: tRows2 } = await query('SELECT * FROM teachers WHERE id = $1', [request.teacher_id]);
          const teacher = tRows2[0] || {};
          const when = slotRow ? `${slotRow.date} ${slotRow.time}` : `${request.date} ${request.requested_time}`;
          const branding4 = await getEmailBranding();
          const whenParts = when.split(' ');
          const { subject, text, html } = buildEmail('confirmation', {
            date: whenParts[0] || when, time: whenParts.slice(1).join(' ') || '',
            teacherName: teacher.name, teacherRoom: teacher.room,
          }, branding4);
          await sendMail({ to: request.email, subject, text, html });
          await query('UPDATE booking_requests SET confirmation_sent_at = $1, updated_at = $1 WHERE id = $2', [now, request.id]);
        } catch (e) {
          console.warn('Sending confirmation after request verify failed:', e?.message || e);
        }
      }
      return res.json({ success: true, message: 'E-Mail bestätigt. Wir informieren Sie, sobald die Lehrkraft Ihnen einen Termin zuweist.' });
    }

    return res.json({ success: true, message: 'E-Mail bestätigt.' });
  } catch (e) {
    console.error('Error verifying email:', e);
    const status = e?.statusCode || 500;
    return res.status(status).json({ error: e?.message || 'Verifikation fehlgeschlagen' });
  }
});

// ── GET /api/events/active ─────────────────────────────────────────────

router.get('/events/active', async (_req, res) => {
  try {
    const now = new Date().toISOString();
    const { rows } = await query(
      `SELECT * FROM events
       WHERE status = 'published'
         AND (booking_opens_at IS NULL OR booking_opens_at <= $1)
         AND (booking_closes_at IS NULL OR booking_closes_at >= $1)
       ORDER BY starts_at DESC LIMIT 1`,
      [now]
    );

    const activeEvent = rows && rows.length ? rows[0] : null;
    res.json({ event: activeEvent });
  } catch (error) {
    console.error('Error fetching active event:', error);
    res.status(500).json({ error: 'Failed to fetch active event' });
  }
});

// ── GET /api/events/upcoming ───────────────────────────────────────────

router.get('/events/upcoming', async (_req, res) => {
  try {
    const now = new Date().toISOString();
    const { rows } = await query(
      `SELECT * FROM events
       WHERE status = 'published' AND starts_at >= $1
       ORDER BY starts_at ASC LIMIT 3`,
      [now]
    );

    res.json({ events: rows || [] });
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming events' });
  }
});

// ── GET /api/health ────────────────────────────────────────────────────

router.get('/health', async (_req, res) => {
  try {
    const [teacherResult, slotResult, bookedResult] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM teachers'),
      query('SELECT COUNT(*) AS count FROM slots'),
      query('SELECT COUNT(*) AS count FROM slots WHERE booked = true')
    ]);

    res.json({
      status: 'ok',
      teacherCount: parseInt(teacherResult.rows[0].count, 10) || 0,
      slotCount: parseInt(slotResult.rows[0].count, 10) || 0,
      bookedCount: parseInt(bookedResult.rows[0].count, 10) || 0
    });
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
});

export default router;
