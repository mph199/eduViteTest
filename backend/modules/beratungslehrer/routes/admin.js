/**
 * Beratungslehrer – Admin-Routen
 *
 * Verwaltung von Beratungslehrern.
 */

import { requireAdmin } from '../../../middleware/auth.js';
import { query } from '../../../config/db.js';
import { createCounselorAdminRoutes, createCounselorUser } from '../../../shared/counselorAdminRoutes.js';

export default createCounselorAdminRoutes({
  tablePrefix: 'bl',
  authMiddleware: requireAdmin,
  counselorLabel: 'Beratungslehrer',

  async onCounselorCreated(counselor, req) {
    return createCounselorUser(counselor, req, {
      tablePrefix: 'bl',
      userRole: 'teacher',
      moduleKey: 'beratungslehrer', // Grants module access via user_module_access
    });
  },

  async onCounselorDeleted(counselorRow) {
    // BL removes module access but keeps the user account (may be used by other modules)
    await query(
      'DELETE FROM user_module_access WHERE user_id = $1 AND module_key = $2',
      [counselorRow.user_id, 'beratungslehrer']
    );
  },
});
