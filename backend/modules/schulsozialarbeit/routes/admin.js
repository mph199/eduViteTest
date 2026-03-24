/**
 * Schulsozialarbeit – Admin-Routen
 *
 * Verwaltung von Berater/innen und Kategorien.
 */

import { requireAdmin } from '../../../middleware/auth.js';
import { query } from '../../../config/db.js';
import { createCounselorAdminRoutes, createCounselorUser } from '../../../shared/counselorAdminRoutes.js';

export default createCounselorAdminRoutes({
  tablePrefix: 'ssw',
  authMiddleware: requireAdmin,
  counselorLabel: 'Berater/in',
  topicTable: 'ssw_categories',
  topicResponseKey: 'categories',
  topicSingularKey: 'category',
  topicForeignKey: 'category_id',
  topicJoinAlias: 'category_name',
  topicInsertCols: ['name', 'description', 'icon', 'sort_order'],
  topicUpdateCols: ['name', 'description', 'icon', 'sort_order', 'active'],
  buildTopicInsertParams: (body) => [
    body.name.trim(),
    body.description || null,
    body.icon || null,
    body.sort_order || 0,
  ],
  buildTopicUpdateParams: (body, id) => [
    body.name.trim(),
    body.description || null,
    body.icon || null,
    body.sort_order || 0,
    body.active !== false,
    id,
  ],

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
