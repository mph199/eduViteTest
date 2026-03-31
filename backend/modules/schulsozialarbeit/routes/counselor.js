/**
 * Schulsozialarbeit – Berater-Routen (authentifiziert)
 *
 * Shared counselor routes + calendar token management.
 */

import express from 'express';
import { db } from '../../../db/database.js';
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
  if (req.user.role === 'admin' || req.user.role === 'superadmin' || hasModuleAccess(req.user, 'schulsozialarbeit')) {
    const counselorId = parseInt(req.query.counselor_id || req.body?.counselor_id, 10) || null;
    if (counselorId) {
      return db.selectFrom('ssw_counselors').selectAll().where('id', '=', counselorId).executeTakeFirst() ?? null;
    }
    return null;
  }

  const counselor = await db.selectFrom('ssw_counselors')
    .selectAll()
    .where('user_id', '=', req.user.id)
    .where('active', '=', true)
    .executeTakeFirst();

  if (!counselor) {
    const err = new Error('Kein Berater-Zugang');
    err.statusCode = 403;
    throw err;
  }
  return counselor;
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
