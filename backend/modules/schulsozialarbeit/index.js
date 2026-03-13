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
    // Öffentliche Routen (Termin buchen)
    app.use('/api/ssw', rateLimiters.booking, publicRouter);
    // Berater-Routen (authentifiziert)
    app.use('/api/ssw/counselor', counselorRouter);
    // Admin-Routen (Berater & Kategorien verwalten)
    app.use('/api/ssw/admin', adminRouter);
  },
};
