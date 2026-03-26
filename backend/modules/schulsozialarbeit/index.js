/**
 * Modul: Schulsozialarbeit
 *
 * Terminbuchung für Beratungsgespräche mit Schulsozialarbeiter/innen.
 * Schüler/innen können vertrauliche Beratungstermine buchen.
 */

import publicRouter from './routes/public.js';
import counselorRouter from './routes/counselor.js';
import adminRouter from './routes/admin.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { createCalendarFeedRoute } from '../../shared/calendarFeedRouter.js';
import { generateCounselorICS } from '../../shared/icalGenerator.js';

export default {
  id: 'schulsozialarbeit',
  name: 'Schulsozialarbeit',

  /** Express-Routen registrieren */
  register(app, { rateLimiters }) {
    // ICS-Feed (public, token-basiert, eigener Rate-Limiter via Elternsprechtag /api/calendar)
    const sswCalendarFeed = createCalendarFeedRoute({
      filename: 'schulsozialarbeit.ics',
      table: 'ssw_counselors',
      appointmentTable: 'ssw_appointments',
      counselorIdColumn: 'counselor_id',
      uidPrefix: 'ssw-appointment',
      calendarTitle: 'Schulsozialarbeit-Termine',
      prodId: '-//BKSB//Schulsozialarbeit//DE',
      auditResource: 'ssw_appointments',
      generateICS: generateCounselorICS,
    });
    app.use('/api/calendar', sswCalendarFeed);

    // Admin- und Berater-Routen ZUERST (ohne Booking-Limiter)
    app.use('/api/ssw/admin', rateLimiters.admin, requireAdmin, adminRouter);
    app.use('/api/ssw/counselor', rateLimiters.auth, requireAuth, counselorRouter);
    // Oeffentliche Routen (Termin buchen) – mit Rate-Limit
    app.use('/api/ssw', rateLimiters.booking, publicRouter);
  },
};
