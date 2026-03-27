/**
 * Schulsozialarbeit – Admin-Routen
 *
 * Verwaltung von Berater/innen.
 */

import { requireModuleAdmin } from '../../../middleware/auth.js';
import { query } from '../../../config/db.js';
import { createCounselorAdminRoutes, createCounselorUser } from '../../../shared/counselorAdminRoutes.js';

export default createCounselorAdminRoutes({
  tablePrefix: 'ssw',
  authMiddleware: requireModuleAdmin('schulsozialarbeit'),
  counselorLabel: 'Berater/in',

  async onCounselorCreated(counselor, req) {
    return createCounselorUser(counselor, req, {
      tablePrefix: 'ssw',
      userRole: 'teacher',
      moduleKey: 'schulsozialarbeit',
    });
  },

  async onCounselorDeleted(counselorRow) {
    // SSW removes module access but keeps the user account (may be used by other modules)
    await query(
      'DELETE FROM user_module_access WHERE user_id = $1 AND module_key = $2',
      [counselorRow.user_id, 'schulsozialarbeit']
    );
  },
});
