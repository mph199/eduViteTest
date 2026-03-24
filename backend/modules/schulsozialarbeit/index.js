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

export default {
  id: 'schulsozialarbeit',
  name: 'Schulsozialarbeit',

  /** Express-Routen registrieren */
  register(app, { rateLimiters }) {
    // Admin- und Berater-Routen ZUERST (ohne Booking-Limiter)
    // Defense in depth: auth on mount level + per-route
    app.use('/api/ssw/admin', rateLimiters.admin, requireAdmin, adminRouter);
    app.use('/api/ssw/counselor', rateLimiters.auth, requireAuth, counselorRouter);
    // Öffentliche Routen (Termin buchen) – mit Rate-Limit
    app.use('/api/ssw', rateLimiters.booking, publicRouter);
  },
};
