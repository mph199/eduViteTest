import express from 'express';
import { sql } from 'kysely';
import { requireModuleAdmin, requireSuperadmin } from '../../middleware/auth.js';
import { db } from '../../db/database.js';
import { isEmailConfigured, sendMail } from '../../config/email.js';
import { buildEmail, getEmailBranding } from '../../emails/template.js';
import { listAdminBookings, cancelBookingAdmin } from '../../modules/elternsprechtag/services/slotsService.js';
import { getTeacherById } from '../../modules/elternsprechtag/services/teachersService.js';
import logger from '../../config/logger.js';

const router = express.Router();
const requireESTAdmin = requireModuleAdmin('elternsprechtag');

// GET /api/admin/bookings
router.get('/bookings', requireESTAdmin, async (_req, res) => {
  try {
    const bookings = await listAdminBookings();
    res.json({ bookings });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching bookings');
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// DELETE /api/admin/bookings/:slotId
router.delete('/bookings/:slotId', requireESTAdmin, async (req, res) => {
  const slotId = parseInt(req.params.slotId, 10);
  if (isNaN(slotId)) return res.status(400).json({ error: 'Invalid slotId' });

  const cancellationMessage = typeof req.body?.cancellationMessage === 'string'
    ? req.body.cancellationMessage.trim()
    : '';
  if (!cancellationMessage) return res.status(400).json({ error: 'cancellationMessage is required' });

  try {
    const { previous } = await cancelBookingAdmin(slotId);

    if (previous && previous.email && previous.verified_at && isEmailConfigured()) {
      try {
        const teacher = await getTeacherById(previous.teacher_id) || {};
        const branding = await getEmailBranding();
        const { subject, text, html } = buildEmail('cancellation', {
          date: previous.date, time: previous.time,
          teacherName: teacher.name,
          cancellationMessage,
        }, branding);
        await sendMail({ to: previous.email, subject, text, html });
        await db.updateTable('slots')
          .set({ cancellation_sent_at: new Date() })
          .where('id', '=', slotId)
          .execute();
      } catch (e) {
        logger.warn({ err: e }, 'Sending cancellation email (admin) failed');
      }
    }

    res.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Error cancelling booking');
    const status = error?.statusCode || 500;
    res.status(status).json({ error: status < 500 ? (error?.message || 'Failed to cancel booking') : 'Failed to cancel booking' });
  }
});

// DELETE /api/admin/booking-requests/:id — anonymize a single booking request
router.delete('/booking-requests/:id', requireSuperadmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const result = await sql`SELECT anonymize_booking_request(${id}) AS success`.execute(db);
    if (!result.rows[0]?.success) {
      return res.status(404).json({ error: 'Booking request not found or already anonymized' });
    }
    logger.info({ bookingRequestId: id }, 'Booking request anonymized');
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error anonymizing booking request');
    res.status(500).json({ error: 'Failed to anonymize booking request' });
  }
});

// POST /api/admin/bookings/anonymize/:eventId
router.post('/bookings/anonymize/:eventId', requireSuperadmin, async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid eventId' });

  try {
    const event = await db.selectFrom('events')
      .select(['id', 'status'])
      .where('id', '=', eventId)
      .executeTakeFirst();
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.status !== 'closed') return res.status(400).json({ error: 'Event must be closed before anonymization' });

    const result = await sql`SELECT anonymize_booking_requests(${eventId}) AS affected`.execute(db);
    const affected = result.rows[0]?.affected || 0;

    logger.info({ eventId, affected }, 'Booking requests anonymized for event');
    res.json({ success: true, anonymized: affected });
  } catch (error) {
    logger.error({ err: error }, 'Error anonymizing booking requests');
    res.status(500).json({ error: 'Failed to anonymize booking requests' });
  }
});

export default router;
