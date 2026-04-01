import express from 'express';
import { sql } from 'kysely';
import { requireAuth } from '../../../../middleware/auth.js';
import { db } from '../../../../db/database.js';
import { isEmailConfigured, sendMail } from '../../../../config/email.js';
import { buildEmail, getEmailBranding } from '../../../../emails/template.js';
import { mapSlotRow, mapBookingRowWithTeacher } from '../../../../utils/mappers.js';
import { getTeacherById } from '../../services/teachersService.js';
import { writeAuditLog } from '../../../../middleware/audit-log.js';
import logger from '../../../../config/logger.js';
import { requireTeacher } from './lib/middleware.js';

const router = express.Router();

/**
 * GET /api/teacher/bookings
 */
router.get('/bookings', requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.teacherId;

    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const bookingRows = await sql`
      SELECT s.*, t.name AS teacher_name, t.subject AS teacher_subject
      FROM slots s
      LEFT JOIN teachers t ON s.teacher_id = t.id
      LEFT JOIN booking_requests br ON br.assigned_slot_id = s.id
      WHERE s.teacher_id = ${teacherId} AND s.booked = true
        AND (br.restricted IS NOT TRUE OR br.id IS NULL)
      ORDER BY s.date, s.time
    `.execute(db);

    const bookings = (bookingRows.rows || []).map((r) => {
      const { teacher_name, teacher_subject, ...slot } = r;
      slot.teacher = { name: teacher_name, subject: teacher_subject };
      return mapBookingRowWithTeacher(slot);
    });

    writeAuditLog(req.user?.id, 'READ', 'slots', null, { teacherId, count: bookings.length, source: 'teacher-bookings' }, req.ip);
    res.json({ bookings });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching teacher bookings');
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * DELETE /api/teacher/bookings/:slotId
 */
router.delete('/bookings/:slotId', requireAuth, requireTeacher, async (req, res) => {
  const slotId = parseInt(req.params.slotId, 10);

  if (isNaN(slotId)) {
    return res.status(400).json({ error: 'Invalid slotId' });
  }

  const cancellationMessage = typeof req.body?.cancellationMessage === 'string'
    ? req.body.cancellationMessage.trim().slice(0, 1000)
    : '';
  if (!cancellationMessage) {
    return res.status(400).json({ error: 'cancellationMessage is required' });
  }

  try {
    const teacherId = req.user.teacherId;

    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const currentResult = await sql`
      SELECT s.*
      FROM slots s
      LEFT JOIN booking_requests br ON br.assigned_slot_id = s.id
      WHERE s.id = ${slotId} AND s.teacher_id = ${teacherId} AND s.booked = true
        AND (br.restricted IS NOT TRUE OR br.id IS NULL)
    `.execute(db);
    const current = currentResult.rows[0] || null;

    if (!current) {
      return res.status(404).json({ error: 'Slot not found, not booked, or not yours' });
    }

    const now = new Date().toISOString();
    const clearedResult = await sql`
      UPDATE slots SET
        booked = false, status = NULL, visitor_type = NULL,
        parent_name = NULL, company_name = NULL, student_name = NULL,
        trainee_name = NULL, representative_name = NULL, class_name = NULL,
        email = NULL, message = NULL,
        verification_token_hash = NULL,
        verification_sent_at = NULL, verified_at = NULL,
        confirmation_sent_at = NULL,
        updated_at = ${now}
      WHERE id = ${slotId} AND teacher_id = ${teacherId} AND booked = true
        AND id NOT IN (SELECT assigned_slot_id FROM booking_requests WHERE assigned_slot_id = ${slotId} AND restricted = TRUE)
      RETURNING *
    `.execute(db);

    if (clearedResult.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found, not booked, or not yours' });
    }

    if (current && current.email && current.verified_at && isEmailConfigured()) {
      try {
        const teacher = await getTeacherById(teacherId) || {};
        const branding = await getEmailBranding();
        const { subject, text, html } = buildEmail('cancellation', {
          date: current.date, time: current.time,
          teacherName: teacher.name,
          cancellationMessage,
        }, branding);
        await sendMail({ to: current.email, subject, text, html });
        await db.updateTable('slots')
          .set({ cancellation_sent_at: new Date().toISOString() })
          .where('id', '=', slotId)
          .execute();
      } catch (e) {
        logger.warn({ err: e }, 'Sending cancellation email (teacher) failed');
      }
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    logger.error({ err: error }, 'Error cancelling booking');
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

/**
 * PUT /api/teacher/bookings/:slotId/accept
 */
router.put('/bookings/:slotId/accept', requireAuth, requireTeacher, async (req, res) => {
  const slotId = parseInt(req.params.slotId, 10);
  if (isNaN(slotId)) {
    return res.status(400).json({ error: 'Invalid slotId' });
  }

  try {
    const teacherId = req.user.teacherId;
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const acceptResult = await sql`
      SELECT s.*
      FROM slots s
      LEFT JOIN booking_requests br ON br.assigned_slot_id = s.id
      WHERE s.id = ${slotId} AND s.teacher_id = ${teacherId} AND s.booked = true
        AND (br.restricted IS NOT TRUE OR br.id IS NULL)
    `.execute(db);
    const current = acceptResult.rows[0] || null;

    if (!current) {
      return res.status(404).json({ error: 'Slot not found or not booked' });
    }

    if (current?.status === 'confirmed') {
      return res.json({ success: true, slot: current });
    }

    if (!current?.verified_at) {
      return res.status(409).json({
        error: 'Buchung kann erst bestätigt werden, nachdem die E-Mail-Adresse verifiziert wurde',
      });
    }

    const now = new Date().toISOString();
    const confirmResult = await sql`
      UPDATE slots SET status = 'confirmed', updated_at = ${now}
      WHERE id = ${slotId} AND teacher_id = ${teacherId} AND booked = true
        AND id NOT IN (SELECT assigned_slot_id FROM booking_requests WHERE assigned_slot_id = ${slotId} AND restricted = TRUE)
      RETURNING *
    `.execute(db);
    const data = confirmResult.rows[0] || null;

    if (!data) {
      return res.status(404).json({ error: 'Slot not found or not booked' });
    }

    if (data && data.verified_at && !data.confirmation_sent_at && isEmailConfigured()) {
      try {
        const teacher = await getTeacherById(teacherId) || {};
        const branding = await getEmailBranding();
        const { subject, text, html } = buildEmail('confirmation', {
          date: data.date, time: data.time,
          teacherName: teacher.name,
          label: 'Ihre Terminbuchung wurde durch die Lehrkraft bestätigt.',
        }, branding);
        await sendMail({ to: data.email, subject, text, html });
        await db.updateTable('slots')
          .set({ confirmation_sent_at: new Date().toISOString() })
          .where('id', '=', data.id)
          .execute();
      } catch (e) {
        logger.warn({ err: e }, 'Sending confirmation email failed');
      }
    }

    res.json({ success: true, slot: data });
  } catch (error) {
    logger.error({ err: error }, 'Error accepting booking');
    res.status(500).json({ error: 'Failed to accept booking' });
  }
});

export default router;
