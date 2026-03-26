/**
 * Modul: Beratungslehrer
 *
 * Sprechstunden buchen bei Beratungslehrern der Schule.
 */

import publicRouter from './routes/public.js';
import counselorRouter from './routes/counselor.js';
import adminRouter from './routes/admin.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { createCalendarFeedRoute } from '../../shared/calendarFeedRouter.js';
import { generateCounselorICS } from '../../shared/icalGenerator.js';

export default {
  id: 'beratungslehrer',
  name: 'Beratungslehrer',

  /** Express-Routen registrieren */
  register(app, { rateLimiters }) {
    // ICS-Feed (public, token-basiert, eigener Rate-Limiter via Elternsprechtag /api/calendar)
    const blCalendarFeed = createCalendarFeedRoute({
      filename: 'beratungslehrer.ics',
      table: 'bl_counselors',
      appointmentTable: 'bl_appointments',
      counselorIdColumn: 'counselor_id',
      uidPrefix: 'bl-appointment',
      calendarTitle: 'Beratungslehrer-Termine',
      prodId: '-//BKSB//Beratungslehrer//DE',
      auditResource: 'bl_appointments',
      generateICS: generateCounselorICS,
    });
    app.use('/api/calendar', blCalendarFeed);

    // Admin- und Berater-Routen ZUERST (ohne Booking-Limiter)
    app.use('/api/bl/admin', rateLimiters.admin, requireAdmin, adminRouter);
    app.use('/api/bl/counselor', rateLimiters.auth, requireAuth, counselorRouter);
    // Oeffentliche Routen (Termin buchen) – mit Rate-Limit
    app.use('/api/bl', rateLimiters.booking, publicRouter);
  },
};
