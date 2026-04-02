/**
 * Modul: Differenzierungswahl (choice)
 *
 * Strukturierte Wunschabgabe fuer Differenzierungsfaecher
 * unter konfigurierbaren Wahldaechern.
 */

import adminRouter from './routes/admin.js';
import publicRouter from './routes/public.js';
import { requireModuleAdmin } from '../../middleware/auth.js';
import { createRateLimiter } from '../../config/rateLimiter.js';

// Strenger Rate-Limiter für Verify/Request-Access (10 Requests pro 15 Min)
const choicePublicLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte später erneut versuchen.' },
});

export default {
  id: 'choice',
  name: 'Differenzierungswahl',

  /** Express-Routen registrieren */
  register(app, { rateLimiters }) {
    // Admin-Routen: Auth zentral, damit kein Route-File Auth vergessen kann
    app.use('/api/choice/admin', rateLimiters.admin, requireModuleAdmin('choice'), adminRouter);

    // Public-Routen: Strenger Rate-Limiter (10/15min), kein Admin-Auth
    app.use('/api/choice/public', choicePublicLimiter, publicRouter);
  },
};
