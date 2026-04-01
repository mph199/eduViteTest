/**
 * Public Booking Routes
 *
 * POST /api/bookings — Reserve a slot (direct booking)
 * POST /api/booking-requests — Request a time window (teacher assigns)
 * GET  /api/bookings/verify/:token — Verify email for booking/request
 */

import express from 'express';
import crypto from 'crypto';
import { db } from '../../../../db/database.js';
import { isEmailConfigured, sendMail } from '../../../../config/email.js';
import { buildEmail, getEmailBranding } from '../../../../emails/template.js';
import { getTeacherById } from '../../services/teachersService.js';
import { reserveBooking, verifyBookingToken } from '../../services/slotsService.js';
import { mapSlotRow } from '../../../../utils/mappers.js';
import { getTimeWindowsForTeacher, formatDateDE } from '../../../../utils/timeWindows.js';
import { findActiveEventId } from '../../../../utils/resolveActiveEvent.js';
import { getVerificationTtlMs } from '../../../../shared/tokenUtils.js';
import logger from '../../../../config/logger.js';
import { validate } from '../../../../middleware/validate.js';
import { bookingSchema, bookingRequestSchema } from '../../../../schemas/booking.js';

const router = express.Router();

/** Trim string value or return empty string for non-strings. */
const normalize = (v) => (typeof v === 'string' ? v.trim() : '');

// ── Helper ────────────────────────────────────────────────────────────

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

  if (reqRow.verified_at) {
    return { requestRow: reqRow, verifiedAt: reqRow.verified_at };
  }

  const ttlMs = getVerificationTtlMs();
  if (reqRow.verification_sent_at) {
    const sentAt = new Date(reqRow.verification_sent_at);
    if (!Number.isNaN(sentAt.getTime()) && Date.now() - sentAt.getTime() > ttlMs) {
      const err = new Error('Link abgelaufen. Bitte senden Sie Ihre Anfrage erneut.');
      err.statusCode = 410;
      throw err;
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

// ── POST /api/bookings ───────────────────────────────────────────────

router.post('/bookings', validate(bookingSchema), async (req, res) => {
  try {
    const payload = req.body || {};
    const consentVersion = typeof payload.consent_version === 'string' ? payload.consent_version.trim() : '';
    if (!consentVersion) return res.status(400).json({ error: 'Einwilligung ist erforderlich' });

    const activeEvent = await findActiveEventId();
    const activeEventId = activeEvent?.id || null;
    if (!activeEventId) return res.status(409).json({ error: 'Buchungen sind aktuell nicht freigegeben' });

    const { slotRow, verificationToken } = await reserveBooking(payload);

    if (slotRow?.event_id && slotRow.event_id !== activeEventId) {
      return res.status(409).json({ error: 'Dieser Termin gehört nicht zum aktuell freigegebenen Elternsprechtag' });
    }

    if (slotRow) {
      await db.insertInto('consent_receipts')
        .values({
          module: 'elternsprechtag', appointment_id: slotRow.id,
          consent_version: consentVersion, consent_purpose: 'Terminbuchung Elternsprechtag',
          ip_address: req.ip || null, user_agent: req.get('user-agent') || null,
        })
        .execute();
    }

    if (slotRow && isEmailConfigured()) {
      try {
        const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
        const verifyUrl = `${baseUrl}/verify?token=${verificationToken}`;
        const teacher = await getTeacherById(slotRow.teacher_id) || {};
        const branding = await getEmailBranding();
        const { subject, text, html } = buildEmail('verify-slot', {
          date: slotRow.date, time: slotRow.time, teacherName: teacher.name, verifyUrl,
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

// ── POST /api/booking-requests ───────────────────────────────────────

router.post('/booking-requests', validate(bookingRequestSchema), async (req, res) => {
  try {
    const payload = req.body || {};

    const activeEvent = await findActiveEventId();
    const activeEventId = activeEvent?.id || null;
    if (!activeEventId) return res.status(409).json({ error: 'Buchungen sind aktuell nicht freigegeben' });

    const teacherIdNum = parseInt(String(payload.teacherId || ''), 10);
    if (!teacherIdNum || isNaN(teacherIdNum)) return res.status(400).json({ error: 'teacherId required' });

    const teacherRow = await db.selectFrom('teachers')
      .select(['id', 'available_from', 'available_until'])
      .where('id', '=', teacherIdNum)
      .executeTakeFirst();
    if (!teacherRow) throw new Error('Teacher not found');

    const requestedTime = typeof payload.requestedTime === 'string' ? payload.requestedTime.trim() : '';
    const allowedTimes = getTimeWindowsForTeacher(teacherRow?.available_from, teacherRow?.available_until);
    if (!allowedTimes.includes(requestedTime)) return res.status(400).json({ error: 'requestedTime invalid' });

    const visitorType = payload.visitorType;
    const className = typeof payload.className === 'string' ? payload.className.trim() : '';
    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';
    const consentVersion = typeof payload.consent_version === 'string' ? payload.consent_version.trim() : '';

    if (!visitorType || !className || !email) return res.status(400).json({ error: 'visitorType, className, email required' });
    if (!consentVersion) return res.status(400).json({ error: 'Einwilligung ist erforderlich' });

    if (visitorType === 'parent') {
      if (!normalize(payload.parentName) || !normalize(payload.studentName)) {
        return res.status(400).json({ error: 'parentName and studentName required for parent type' });
      }
    } else if (visitorType === 'company') {
      if (!normalize(payload.companyName) || !normalize(payload.traineeName) || !normalize(payload.representativeName)) {
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
      event_id: activeEventId, teacher_id: teacherIdNum,
      requested_time: requestedTime, date: eventDate, status: 'requested',
      visitor_type: visitorType, class_name: className, email,
      message: message || null, verification_token_hash: verificationTokenHash,
      verification_sent_at: now, verified_at: null, confirmation_sent_at: null,
      assigned_slot_id: null, updated_at: now,
      parent_name: visitorType === 'parent' ? normalize(payload.parentName) : null,
      student_name: visitorType === 'parent' ? normalize(payload.studentName) : null,
      company_name: visitorType === 'company' ? normalize(payload.companyName) : null,
      trainee_name: visitorType === 'company' ? normalize(payload.traineeName) : null,
      representative_name: visitorType === 'company' ? normalize(payload.representativeName) : null,
    };

    const created = await db.insertInto('booking_requests').values(insertValues).returningAll().executeTakeFirst();

    if (created) {
      await db.insertInto('consent_receipts')
        .values({
          module: 'elternsprechtag', appointment_id: created.id,
          consent_version: consentVersion, consent_purpose: 'Terminbuchung Elternsprechtag',
          ip_address: req.ip || null, user_agent: req.get('user-agent') || null,
        })
        .execute();
    }

    if (created && isEmailConfigured()) {
      try {
        const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
        const verifyUrl = `${baseUrl}/verify?token=${verificationToken}`;
        const teacher = await getTeacherById(teacherIdNum) || {};
        const branding = await getEmailBranding();
        const { subject, text, html } = buildEmail('verify-request', {
          date: created.date, requestedTime: created.requested_time, teacherName: teacher.name, verifyUrl,
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

// ── GET /api/bookings/verify/:token ──────────────────────────────────

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

    if (slot) {
      if (slot.status === 'confirmed' && !slot.confirmation_sent_at && isEmailConfigured()) {
        try {
          const teacher = await getTeacherById(slot.teacher_id) || {};
          const branding = await getEmailBranding();
          const { subject, text, html } = buildEmail('confirmation', {
            date: slot.date, time: slot.time, teacherName: teacher.name,
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

    if (request) {
      if (request.status === 'accepted' && request.assigned_slot_id && !request.confirmation_sent_at && isEmailConfigured()) {
        try {
          const slotRow = await db.selectFrom('slots')
            .select(['id', 'teacher_id', 'time', 'date', 'booked', 'status', 'email', 'verified_at'])
            .where('id', '=', request.assigned_slot_id)
            .executeTakeFirst();
          const teacher = await getTeacherById(request.teacher_id) || {};
          const when = slotRow ? `${slotRow.date} ${slotRow.time}` : `${request.date} ${request.requested_time}`;
          const branding = await getEmailBranding();
          const whenParts = when.split(' ');
          const { subject, text, html } = buildEmail('confirmation', {
            date: whenParts[0] || when, time: whenParts.slice(1).join(' ') || '',
            teacherName: teacher.name,
          }, branding);
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

export default router;
