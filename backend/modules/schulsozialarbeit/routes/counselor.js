/**
 * Schulsozialarbeit – Berater-Routen (authentifiziert)
 *
 * Shared counselor routes + calendar token management.
 */

import express from 'express';
import { query } from '../../../config/db.js';
import { hasModuleAccess } from '../../../middleware/auth.js';
import { createCounselorRoutes } from '../../../shared/counselorRoutes.js';
import { createCalendarTokenRoutes } from '../../../shared/calendarTokenRoutes.js';

const SSW_TABLES = {
  counselorsTable: 'ssw_counselors',
  appointmentsTable: 'ssw_appointments',
  scheduleTable: 'ssw_weekly_schedule',
  counselorLabel: 'Berater/in',
};

async function resolveCounselor(req) {
  // Admin/Superadmin or users with SSW module access can access any counselor by ID
  if (req.user.role === 'admin' || req.user.role === 'superadmin' || hasModuleAccess(req.user, 'schulsozialarbeit')) {
    const counselorId = parseInt(req.query.counselor_id || req.body?.counselor_id, 10) || null;
    if (counselorId) {
      const { rows } = await query('SELECT * FROM ssw_counselors WHERE id = $1', [counselorId]);
      return rows[0] || null;
    }
    return null;
  }

  // Regular users: must be linked to a counselor
  const { rows } = await query('SELECT * FROM ssw_counselors WHERE user_id = $1 AND active = TRUE', [req.user.id]);
  if (!rows.length) {
    const err = new Error('Kein Berater-Zugang');
    err.statusCode = 403;
    throw err;
  }
  return rows[0];
}

const sharedRouter = createCounselorRoutes({
  tables: SSW_TABLES,
  logPrefix: 'SSW',
  resolveCounselor,
});

const calendarTokenRouter = createCalendarTokenRoutes({
  table: 'ssw_counselors',
  logPrefix: 'SSW',
  resolveCounselorId: async (req) => {
    const counselor = await resolveCounselor(req);
    return counselor?.id || null;
  },
});

const router = express.Router();
router.use('/', calendarTokenRouter);
router.use('/', sharedRouter);

export default router;
