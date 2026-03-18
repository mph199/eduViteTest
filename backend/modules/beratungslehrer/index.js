/**
 * Modul: Beratungslehrer
 *
 * Sprechstunden buchen und anonyme Anfragen stellen
 * bei Beratungslehrern der Schule.
 */

import publicRouter from './routes/public.js';
import counselorRouter from './routes/counselor.js';
import adminRouter from './routes/admin.js';
import { requireAuth, requireBeratungslehrer } from '../../middleware/auth.js';

export default {
  id: 'beratungslehrer',
  name: 'Beratungslehrer',

  /** Express-Routen registrieren */
  register(app, { rateLimiters }) {
    // Admin- und Berater-Routen ZUERST (ohne Booking-Limiter)
    // Defense in depth: auth on mount level + per-route
    app.use('/api/bl/admin', rateLimiters.admin, requireBeratungslehrer, adminRouter);
    app.use('/api/bl/counselor', requireAuth, counselorRouter);
    // Oeffentliche Routen (Termin buchen, anonyme Anfragen) – mit Rate-Limit
    app.use('/api/bl', rateLimiters.booking, publicRouter);
  },
};
