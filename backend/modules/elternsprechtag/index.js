/**
 * Modul: Elternsprechtag
 *
 * Stellt die öffentliche Buchungsseite und den Lehrkraft-Bereich
 * für den Eltern- und Ausbildersprechtag bereit.
 */

import rateLimit from 'express-rate-limit';
import publicRouter from './routes/public.js';
import teacherRouter from './routes/teacher.js';
import calendarRouter from './routes/calendar.js';
import { requireAuth } from '../../middleware/auth.js';

// Eigener Rate-Limiter für den Kalender-Feed (nicht booking-Limiter).
// Kalender-Clients pollen regelmäßig (Outlook ~30min, Apple ~15min, Google ~12h).
// V1: IP-basiert. V2-Option: zusätzlich tokenbasiert/kombiniert.
const calendarFeedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
});

export default {
  id: 'elternsprechtag',
  name: 'Eltern- und Ausbildersprechtag',

  /** Express-Routen registrieren */
  register(app, { rateLimiters }) {
    // WICHTIG: Calendar-Feed MUSS vor publicRouter registriert werden,
    // da /api/calendar/* sonst von publicRouter abgefangen wird.
    // Diese Reihenfolge NICHT ändern ohne die Calendar-Route zu testen!
    app.use('/api/calendar', calendarFeedLimiter);
    app.use('/api/calendar', calendarRouter);

    app.use('/api/teacher', rateLimiters.auth, requireAuth, teacherRouter);
    // Rate-Limit nur auf oeffentliche Buchungs-Pfade (nicht alle /api/*)
    app.use('/api/teachers', rateLimiters.booking);
    app.use('/api/slots', rateLimiters.booking);
    app.use('/api/bookings', rateLimiters.booking);
    app.use('/api/booking-requests', rateLimiters.booking);
    app.use('/api/events', rateLimiters.booking);
    app.use('/api/health', rateLimiters.booking);
    app.use('/api/dev', rateLimiters.booking);
    app.use('/api', publicRouter);
  },
};
