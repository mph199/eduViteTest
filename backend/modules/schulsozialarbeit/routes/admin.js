/**
 * Schulsozialarbeit – Admin-Routen
 *
 * Verwaltung von Berater/innen.
 */

import { requireModuleAdmin } from '../../../middleware/auth.js';
import { db } from '../../../db/database.js';
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
    await db.deleteFrom('user_module_access')
      .where('user_id', '=', counselorRow.user_id)
      .where('module_key', '=', 'schulsozialarbeit')
      .execute();
  },
});
