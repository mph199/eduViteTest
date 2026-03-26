/**
 * Schulsozialarbeit – Berater-Routen (authentifiziert)
 *
 * Thin wrapper around the shared counselor route factory.
 */

import { query } from '../../../config/db.js';
import { createCounselorRoutes } from '../../../shared/counselorRoutes.js';

const SSW_TABLES = {
  counselorsTable: 'ssw_counselors',
  appointmentsTable: 'ssw_appointments',
  scheduleTable: 'ssw_weekly_schedule',
  counselorLabel: 'Berater/in',
};

async function resolveCounselor(req) {
  // Admin/Superadmin/SSW can access any counselor by ID
  if (req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.role === 'ssw') {
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

const router = createCounselorRoutes({
  tables: SSW_TABLES,
  logPrefix: 'SSW',
  resolveCounselor,
});

export default router;
