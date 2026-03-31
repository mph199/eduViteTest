import express from 'express';
import crypto from 'crypto';
import { db } from '../../../db/database.js';
import { sql } from 'kysely';

import { isEmailConfigured, sendMail, getLastEmailDebugInfo } from '../../../config/email.js';
import { buildEmail, getEmailBranding } from '../../../emails/template.js';
import { listTeachers, getTeacherById } from '../services/teachersService.js';
import { reserveBooking, verifyBookingToken } from '../services/slotsService.js';
import { mapSlotRow } from '../../../utils/mappers.js';
import { getTimeWindowsForTeacher, formatDateDE } from '../../../utils/timeWindows.js';
import { resolveActiveEvent, findActiveEventId } from '../../../utils/resolveActiveEvent.js';
import { getVerificationTtlMs } from '../../../shared/tokenUtils.js';
import logger from '../../../config/logger.js';
import { validate } from '../../../middleware/validate.js';
import { bookingSchema, bookingRequestSchema } from '../../../schemas/booking.js';

const router = express.Router();

// ── Helpers ────────────────────────────────────────────────────────────

async function verifyBookingRequestToken(token) {
  if (!token || typeof token !== 'string') {
    const err = new Error('Ungültiger oder abgelaufener Link');
    err.statusCode = 404;
    throw err;
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const rows = await db.selectFrom('booking_requests')
    .select([
      'id', 'event_id', 'teacher_id', 'requested_time', 'date', 'status',
      'visitor_type', 'parent_name', 'company_name', 'student_name',
      'trainee_name', 'representative_name', 'class_name', 'email',
      'assigned_slot_id', 'created_at',
    ])
    .where('status', '=', 'requested')
    .where('verification_token_hash', '=', tokenHash)
    .execute();
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

  const ttlMs = getVerificationTtlMs();

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
  await db.updateTable('booking_requests')
    .set({ verified_at: now, verification_token_hash: null, updated_at: now })
    .where('id', '=', reqRow.id)
    .execute();

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
    logger.error({ err: error }, 'Error fetching teachers');
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

    const teacherRows = await db.selectFrom('teachers')
      .select(['id', 'available_from', 'available_until'])
      .where('id', '=', teacherIdNum)
      .execute();
    const teacherRow = teacherRows[0] || null;
    if (!teacherRow) throw new Error('Teacher not found');

    // Resolve event scope: explicit eventId OR active published event
    let resolvedEventId = null;
    let resolvedEventStartsAt = null;
    let resolvedEventDate = null;
    if (eventId !== undefined) {
      const parsed = parseInt(String(eventId), 10);
      if (isNaN(parsed)) {
        return res.status(400).json({ error: 'eventId must be a number' });
      }
      resolvedEventId = parsed;
      try {
        const evRows = await db.selectFrom('events')
          .select(['id', 'starts_at'])
          .where('id', '=', resolvedEventId)
          .execute();
        const ev = evRows[0] || null;
        resolvedEventStartsAt = ev?.starts_at || null;
      } catch {
        resolvedEventStartsAt = null;
      }
    } else {
      const resolved = await resolveActiveEvent();
      resolvedEventId = resolved.eventId;
      resolvedEventDate = resolved.eventDate;
    }

    const times = getTimeWindowsForTeacher(teacherRow?.available_from, teacherRow?.available_until);
    const eventDate = resolvedEventDate
      || (resolvedEventStartsAt ? formatDateDE(resolvedEventStartsAt) : null)
      || '01.01.1970';

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
    logger.error({ err: error }, 'Error fetching slots');
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// ── POST /api/bookings ─────────────────────────────────────────────────

router.post('/bookings', validate(bookingSchema), async (req, res) => {
  try {
    const payload = req.body || {};
    const consentVersion = typeof payload.consent_version === 'string' ? payload.consent_version.trim() : '';

    if (!consentVersion) {
      return res.status(400).json({ error: 'Einwilligung ist erforderlich' });
    }

    // Require active published event before accepting booking requests
    const activeEvent = await findActiveEventId();
    const activeEventId = activeEvent?.id || null;
    if (!activeEventId) {
      return res.status(409).json({ error: 'Buchungen sind aktuell nicht freigegeben' });
    }

    const { slotRow, verificationToken } = await reserveBooking(payload);

    // If the slot is linked to an event, enforce it matches active event
    if (slotRow?.event_id && slotRow.event_id !== activeEventId) {
      return res.status(409).json({ error: 'Dieser Termin gehört nicht zum aktuell freigegebenen Elternsprechtag' });
    }

    // Consent-Receipt (append-only, Art. 7 Abs. 1)
    if (slotRow) {
      await db.insertInto('consent_receipts')
        .values({
          module: 'elternsprechtag',
          appointment_id: slotRow.id,
          consent_version: consentVersion,
          consent_purpose: 'Terminbuchung Elternsprechtag',
          ip_address: req.ip || null,
          user_agent: req.get('user-agent') || null,
        })
        .execute();
    }

    // Send verification email (best-effort)
    if (slotRow && isEmailConfigured()) {
      try {
        const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
        const verifyUrl = `${baseUrl}/verify?token=${verificationToken}`;
        const teacher = await getTeacherById(slotRow.teacher_id) || {};
        const branding = await getEmailBranding();
        const { subject, text, html } = buildEmail('verify-slot', {
          date: slotRow.date, time: slotRow.time,
          teacherName: teacher.name, verifyUrl,
        }, branding);
        await sendMail({ to: payload.email, subject, text, html });
      } catch (e) {
        logger.warn({ err: e }, 'Sending verification email failed');
      }
    }

    res.json({ success: true, updatedSlot: mapSlotRow(slotRow) });
  } catch (error) {
    logger.error({ err: error }, 'Error creating booking');
    const status = error?.statusCode || 500;
    res.status(status).json({ error: status < 500 ? (error?.message || 'Failed to create booking') : 'Failed to create booking' });
  }
});

// ── POST /api/booking-requests ─────────────────────────────────────────

router.post('/booking-requests', validate(bookingRequestSchema), async (req, res) => {
  try {
    const payload = req.body || {};

    // Require active published event
    const activeEvent = await findActiveEventId();
    const activeEventId = activeEvent?.id || null;
    if (!activeEventId) {
      return res.status(409).json({ error: 'Buchungen sind aktuell nicht freigegeben' });
    }

    const teacherIdNum = parseInt(String(payload.teacherId || ''), 10);
    if (!teacherIdNum || isNaN(teacherIdNum)) {
      return res.status(400).json({ error: 'teacherId required' });
    }

    const teacherLookupRows = await db.selectFrom('teachers')
      .select(['id', 'available_from', 'available_until'])
      .where('id', '=', teacherIdNum)
      .execute();
    const teacherRow = teacherLookupRows[0] || null;
    if (!teacherRow) throw new Error('Teacher not found');

    const requestedTime = typeof payload.requestedTime === 'string' ? payload.requestedTime.trim() : '';
    const allowedTimes = getTimeWindowsForTeacher(teacherRow?.available_from, teacherRow?.available_until);
    if (!allowedTimes.includes(requestedTime)) {
      return res.status(400).json({ error: 'requestedTime invalid' });
    }

    const visitorType = payload.visitorType;
    const className = typeof payload.className === 'string' ? payload.className.trim() : '';
    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';
    const consentVersion = typeof payload.consent_version === 'string' ? payload.consent_version.trim() : '';

    if (!visitorType || !className || !email) {
      return res.status(400).json({ error: 'visitorType, className, email required' });
    }
    if (!consentVersion) {
      return res.status(400).json({ error: 'Einwilligung ist erforderlich' });
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

    const insertValues = {
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
      insertValues.parent_name = normalize(payload.parentName);
      insertValues.student_name = normalize(payload.studentName);
      insertValues.company_name = null;
      insertValues.trainee_name = null;
      insertValues.representative_name = null;
    } else {
      insertValues.company_name = normalize(payload.companyName);
      insertValues.trainee_name = normalize(payload.traineeName);
      insertValues.representative_name = normalize(payload.representativeName);
      insertValues.parent_name = null;
      insertValues.student_name = null;
    }

    const created = await db.insertInto('booking_requests')
      .values(insertValues)
      .returningAll()
      .executeTakeFirst();

    // Consent-Receipt (append-only, Art. 7 Abs. 1)
    if (created) {
      await db.insertInto('consent_receipts')
        .values({
          module: 'elternsprechtag',
          appointment_id: created.id,
          consent_version: consentVersion,
          consent_purpose: 'Terminbuchung Elternsprechtag',
          ip_address: req.ip || null,
          user_agent: req.get('user-agent') || null,
        })
        .execute();
    }

    // Send verification email (best-effort)
    if (created && isEmailConfigured()) {
      try {
        const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
        const verifyUrl = `${baseUrl}/verify?token=${verificationToken}`;
        const teacher = await getTeacherById(teacherIdNum) || {};
        const branding = await getEmailBranding();
        const { subject, text, html } = buildEmail('verify-request', {
          date: created.date, requestedTime: created.requested_time,
          teacherName: teacher.name, verifyUrl,
        }, branding);
        await sendMail({ to: email, subject, text, html });
      } catch (e) {
        logger.warn({ err: e }, 'Sending verification email (request) failed');
      }
    }

    return res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error creating booking request');
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
          const teacher = await getTeacherById(slot.teacher_id) || {};
          const branding = await getEmailBranding();
          const { subject, text, html } = buildEmail('confirmation', {
            date: slot.date, time: slot.time,
            teacherName: teacher.name,
            label: 'Ihre Terminbuchung wurde durch die Lehrkraft bestätigt.',
          }, branding);
          await sendMail({ to: slot.email, subject, text, html });
          await db.updateTable('slots')
            .set({ confirmation_sent_at: now, updated_at: now })
            .where('id', '=', slot.id)
            .execute();
        } catch (e) {
          logger.warn({ err: e }, 'Sending confirmation after verify failed');
        }
      }
      return res.json({ success: true, message: 'E-Mail bestätigt. Wir informieren Sie bei Bestätigung durch die Lehrkraft.' });
    }

    // Booking request verification path
    if (request) {
      if (request.status === 'accepted' && request.assigned_slot_id && !request.confirmation_sent_at && isEmailConfigured()) {
        try {
          const slotLookupRows = await db.selectFrom('slots')
            .select(['id', 'teacher_id', 'time', 'date', 'booked', 'status', 'email', 'verified_at'])
            .where('id', '=', request.assigned_slot_id)
            .execute();
          const slotRow = slotLookupRows[0] || null;
          const teacher = await getTeacherById(request.teacher_id) || {};
          const when = slotRow ? `${slotRow.date} ${slotRow.time}` : `${request.date} ${request.requested_time}`;
          const branding4 = await getEmailBranding();
          const whenParts = when.split(' ');
          const { subject, text, html } = buildEmail('confirmation', {
            date: whenParts[0] || when, time: whenParts.slice(1).join(' ') || '',
            teacherName: teacher.name,
          }, branding4);
          await sendMail({ to: request.email, subject, text, html });
          await db.updateTable('booking_requests')
            .set({ confirmation_sent_at: now, updated_at: now })
            .where('id', '=', request.id)
            .execute();
        } catch (e) {
          logger.warn({ err: e }, 'Sending confirmation after request verify failed');
        }
      }
      return res.json({ success: true, message: 'E-Mail bestätigt. Wir informieren Sie, sobald die Lehrkraft Ihnen einen Termin zuweist.' });
    }

    return res.json({ success: true, message: 'E-Mail bestätigt.' });
  } catch (e) {
    logger.error({ err: e }, 'Error verifying email');
    const status = e?.statusCode || 500;
    return res.status(status).json({ error: e?.message || 'Verifikation fehlgeschlagen' });
  }
});

// ── GET /api/events/active ─────────────────────────────────────────────

router.get('/events/active', async (_req, res) => {
  try {
    const now = new Date().toISOString();
    const rows = await db.selectFrom('events')
      .select([
        'id', 'name', 'school_year', 'starts_at', 'ends_at', 'timezone', 'status',
        'booking_opens_at', 'booking_closes_at',
      ])
      .where('status', '=', 'published')
      .where((eb) =>
        eb.or([
          eb('booking_opens_at', 'is', null),
          eb('booking_opens_at', '<=', now),
        ])
      )
      .where((eb) =>
        eb.or([
          eb('booking_closes_at', 'is', null),
          eb('booking_closes_at', '>=', now),
        ])
      )
      .orderBy('starts_at', 'desc')
      .limit(1)
      .execute();

    const activeEvent = rows && rows.length ? rows[0] : null;
    res.json({ event: activeEvent });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching active event');
    res.status(500).json({ error: 'Failed to fetch active event' });
  }
});

// ── GET /api/events/upcoming ───────────────────────────────────────────

router.get('/events/upcoming', async (_req, res) => {
  try {
    const now = new Date().toISOString();
    const rows = await db.selectFrom('events')
      .select([
        'id', 'name', 'school_year', 'starts_at', 'ends_at', 'timezone', 'status',
        'booking_opens_at', 'booking_closes_at',
      ])
      .where('status', '=', 'published')
      .where('starts_at', '>=', now)
      .orderBy('starts_at', 'asc')
      .limit(3)
      .execute();

    res.json({ events: rows || [] });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching upcoming events');
    res.status(500).json({ error: 'Failed to fetch upcoming events' });
  }
});

// ── GET /api/health ────────────────────────────────────────────────────

router.get('/health', async (_req, res) => {
  try {
    await sql`SELECT 1`.execute(db);
    res.json({ status: 'ok' });
  } catch (error) {
    logger.error({ err: error }, 'Error in health check');
    res.status(500).json({ status: 'error' });
  }
});

export default router;
