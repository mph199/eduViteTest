/**
 * Modul: Differenzierungswahl (choice)
 *
 * Strukturierte Wunschabgabe fuer Differenzierungsfaecher
 * unter konfigurierbaren Wahldaechern.
 */

import adminRouter from './routes/admin.js';
import publicRouter from './routes/public.js';
import { requireModuleAdmin } from '../../middleware/auth.js';

export default {
  id: 'choice',
  name: 'Differenzierungswahl',

  /** Express-Routen registrieren */
  register(app, { rateLimiters }) {
    // Admin-Routen: Auth zentral, damit kein Route-File Auth vergessen kann
    app.use('/api/choice/admin', rateLimiters.admin, requireModuleAdmin('choice'), adminRouter);

    // Public-Routen: Rate-Limited, kein Admin-Auth (eigene choice_session-Middleware)
    app.use('/api/choice/public', rateLimiters.booking, publicRouter);
  },
};
