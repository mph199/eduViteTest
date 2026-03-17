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
    app.use('/api', rateLimiters.booking, publicRouter);
    app.use('/api/teacher', rateLimiters.admin, teacherRouter);
  },
};
