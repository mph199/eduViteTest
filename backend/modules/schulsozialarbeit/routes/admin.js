/**
 * Schulsozialarbeit – Admin-Routen
 *
 * Verwaltung von Berater/innen.
 */

import { requireAdmin } from '../../../middleware/auth.js';
import { query } from '../../../config/db.js';
import { createCounselorAdminRoutes, createCounselorUser } from '../../../shared/counselorAdminRoutes.js';

export default createCounselorAdminRoutes({
  tablePrefix: 'ssw',
  authMiddleware: requireAdmin,
  counselorLabel: 'Berater/in',

  async onCounselorCreated(counselor, req) {
    return createCounselorUser(counselor, req, {
      tablePrefix: 'ssw',
      userRole: 'ssw',
      moduleKey: null, // SSW uses role-based auth, no module_access entry needed
    });
  },

  async onCounselorDeleted(counselorRow) {
    // SSW deletes the linked user entirely
    await query('DELETE FROM users WHERE id = $1', [counselorRow.user_id]);
  },
});
