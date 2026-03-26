/**
 * Token-Management für Kalender-Abos (Elternsprechtag / Lehrkräfte).
 *
 * Nutzt die Shared Factory aus shared/calendarTokenRoutes.js.
 * Auth wird im übergeordneten teacher.js-Router via requireAuth + requireTeacher sichergestellt.
 */

import { createCalendarTokenRoutes } from '../../../../shared/calendarTokenRoutes.js';

export default createCalendarTokenRoutes({
  table: 'teachers',
  logPrefix: 'EST',
  resolveCounselorId: async (req) => req.user?.teacherId || null,
});
