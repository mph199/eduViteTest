import express from 'express';
import { requireAuth } from '../../../../middleware/auth.js';
import { query } from '../../../../config/db.js';
import { isEmailConfigured, sendMail } from '../../../../config/email.js';
import { buildEmail, getEmailBranding } from '../../../../emails/template.js';
import { mapSlotRow, mapBookingRowWithTeacher } from '../../../../utils/mappers.js';
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

    const { rows: bookingRows } = await query(
      `SELECT s.*, t.name AS teacher_name, t.subject AS teacher_subject
       FROM slots s
       LEFT JOIN teachers t ON s.teacher_id = t.id
       WHERE s.teacher_id = $1 AND s.booked = true
       ORDER BY s.date, s.time`,
      [teacherId]
    );

    const bookings = (bookingRows || []).map((r) => {
      const { teacher_name, teacher_subject, ...slot } = r;
      slot.teacher = { name: teacher_name, subject: teacher_subject };
      return mapBookingRowWithTeacher(slot);
    });

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
    ? req.body.cancellationMessage.trim()
    : '';
  if (!cancellationMessage) {
    return res.status(400).json({ error: 'cancellationMessage is required' });
  }

  try {
    const teacherId = req.user.teacherId;

    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const { rows: currentRows } = await query(
      'SELECT * FROM slots WHERE id = $1 AND teacher_id = $2 AND booked = true',
      [slotId, teacherId]
    );
    const current = currentRows[0] || null;

    if (!current) {
      return res.status(404).json({ error: 'Slot not found, not booked, or not yours' });
    }

    const { rows: clearedRows } = await query(
      `UPDATE slots SET
         booked = false, status = NULL, visitor_type = NULL,
         parent_name = NULL, company_name = NULL, student_name = NULL,
         trainee_name = NULL, representative_name = NULL, class_name = NULL,
         email = NULL, message = NULL,
         verification_token_hash = NULL,
         verification_sent_at = NULL, verified_at = NULL,
         confirmation_sent_at = NULL,
         updated_at = $1
       WHERE id = $2 AND teacher_id = $3 AND booked = true
       RETURNING *`,
      [new Date().toISOString(), slotId, teacherId]
    );

    if (clearedRows.length === 0) {
      return res.status(404).json({ error: 'Slot not found, not booked, or not yours' });
    }

    if (current && current.email && current.verified_at && isEmailConfigured()) {
      try {
        const { rows: tcRows } = await query('SELECT * FROM teachers WHERE id = $1', [teacherId]);
        const teacher = tcRows[0] || {};
        const branding = await getEmailBranding();
        const { subject, text, html } = buildEmail('cancellation', {
          date: current.date, time: current.time,
          teacherName: teacher.name, teacherRoom: teacher.room,
          cancellationMessage,
        }, branding);
        await sendMail({ to: current.email, subject, text, html });
        await query('UPDATE slots SET cancellation_sent_at = $1 WHERE id = $2', [new Date().toISOString(), slotId]);
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

    const { rows: acceptRows } = await query(
      'SELECT * FROM slots WHERE id = $1 AND teacher_id = $2 AND booked = true',
      [slotId, teacherId]
    );
    const current = acceptRows[0] || null;

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

    const { rows: confirmRows } = await query(
      `UPDATE slots SET status = 'confirmed', updated_at = $1
       WHERE id = $2 AND teacher_id = $3 AND booked = true
       RETURNING *`,
      [new Date().toISOString(), slotId, teacherId]
    );
    const data = confirmRows[0] || null;

    if (!data) {
      return res.status(404).json({ error: 'Slot not found or not booked' });
    }

    if (data && data.verified_at && !data.confirmation_sent_at && isEmailConfigured()) {
      try {
        const { rows: teachConfirmRows } = await query('SELECT * FROM teachers WHERE id = $1', [teacherId]);
        const teacher = teachConfirmRows[0] || {};
        const branding = await getEmailBranding();
        const { subject, text, html } = buildEmail('confirmation', {
          date: data.date, time: data.time,
          teacherName: teacher.name, teacherRoom: teacher.room,
          label: 'Ihre Terminbuchung wurde durch die Lehrkraft bestätigt.',
        }, branding);
        await sendMail({ to: data.email, subject, text, html });
        await query('UPDATE slots SET confirmation_sent_at = $1 WHERE id = $2', [new Date().toISOString(), data.id]);
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
