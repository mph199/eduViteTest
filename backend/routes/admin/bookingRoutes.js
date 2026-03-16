import express from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { query } from '../../config/db.js';
import { isEmailConfigured, sendMail } from '../../config/email.js';
import { buildEmail, getEmailBranding } from '../../emails/template.js';
import { listAdminBookings, cancelBookingAdmin } from '../../modules/elternsprechtag/services/slotsService.js';

const router = express.Router();

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

export default router;
