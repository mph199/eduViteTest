/**
 * Modul: Elternsprechtag
 *
 * Stellt die öffentliche Buchungsseite und den Lehrkraft-Bereich
 * für den Eltern- und Ausbildersprechtag bereit.
 */

import publicRouter from './routes/public.js';
import teacherRouter from './routes/teacher.js';

export default {
  id: 'elternsprechtag',
  name: 'Eltern- und Ausbildersprechtag',

  /** Express-Routen registrieren */
  register(app, { rateLimiters }) {
    app.use('/api/teacher', rateLimiters.auth, teacherRouter);
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
