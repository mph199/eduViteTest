/**
 * Modul: Beratungslehrer
 *
 * Sprechstunden buchen und anonyme Anfragen stellen
 * bei Beratungslehrern der Schule.
 */

import publicRouter from './routes/public.js';
import counselorRouter from './routes/counselor.js';
import adminRouter from './routes/admin.js';

export default {
  id: 'beratungslehrer',
  name: 'Beratungslehrer',

  /** Express-Routen registrieren */
  register(app, { rateLimiters }) {
    // Admin- und Berater-Routen ZUERST (ohne Booking-Limiter)
    app.use('/api/bl/admin', adminRouter);
    app.use('/api/bl/counselor', counselorRouter);
    // Oeffentliche Routen (Termin buchen, anonyme Anfragen) – mit Rate-Limit
    app.use('/api/bl', rateLimiters.booking, publicRouter);
  },
};
