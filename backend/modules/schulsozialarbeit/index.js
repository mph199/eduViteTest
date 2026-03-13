/**
 * Modul: Schulsozialarbeit
 *
 * Terminbuchung für Beratungsgespräche mit Schulsozialarbeiter/innen.
 * Schüler/innen können vertrauliche Beratungstermine buchen.
 */

import publicRouter from './routes/public.js';
import counselorRouter from './routes/counselor.js';
import adminRouter from './routes/admin.js';

export default {
  id: 'schulsozialarbeit',
  name: 'Schulsozialarbeit',

  /** Express-Routen registrieren */
  register(app, { rateLimiters }) {
    // Admin- und Berater-Routen ZUERST (ohne Booking-Limiter)
    app.use('/api/ssw/admin', adminRouter);
    app.use('/api/ssw/counselor', counselorRouter);
    // Öffentliche Routen (Termin buchen) – mit Rate-Limit
    app.use('/api/ssw', rateLimiters.booking, publicRouter);
  },
};
