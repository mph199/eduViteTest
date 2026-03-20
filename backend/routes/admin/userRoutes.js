import express from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { query, getClient } from '../../config/db.js';
import { assertSafeIdentifier } from '../../shared/sqlGuards.js';
import logger from '../../config/logger.js';

const router = express.Router();

const VALID_MODULE_KEYS = ['beratungslehrer', 'schulsozialarbeit', 'flow'];

// GET /api/admin/users
router.get('/users', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, u.role, u.teacher_id, u.created_at, u.updated_at,
              COALESCE(
                (SELECT json_agg(uma.module_key ORDER BY uma.module_key)
                 FROM user_module_access uma WHERE uma.user_id = u.id),
                '[]'::json
              ) AS modules
       FROM users u ORDER BY u.id`
    );
    return res.json({ users: rows });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching admin users');
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const { role } = req.body || {};
  const roleStr = String(role || '').trim();
  if (!['admin', 'teacher', 'superadmin', 'ssw'].includes(roleStr)) {
    return res.status(400).json({ error: 'role must be "admin", "teacher", "superadmin" or "ssw"' });
  }

  // Prevent an admin from demoting themselves.
  try {
    if (req.user?.username) {
      const { rows: meRows } = await query('SELECT id, role FROM users WHERE username = $1 LIMIT 1', [req.user.username]);
      const me = meRows[0] || null;
      if (me && Number(me.id) === userId && roleStr !== 'admin') {
        return res.status(400).json({ error: 'You cannot remove your own admin role.' });
      }
    }
  } catch {
    // ignore safety check failures
  }

  try {
    const { rows } = await query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role, teacher_id, created_at, updated_at',
      [roleStr, userId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ success: true, user: rows[0] });
  } catch (error) {
    logger.error({ err: error }, 'Error updating admin user role');
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// Counselor cleanup config per module key
// NOTE: Table names are static constants, never from user input.
// Keys must match VALID_MODULE_KEYS entries that have counselor data.
const COUNSELOR_TABLES = {
  beratungslehrer: {
    counselors: 'bl_counselors',
    appointments: 'bl_appointments',
    schedule: 'bl_weekly_schedule',
    label: 'Beratungslehrkraft',
  },
  schulsozialarbeit: {
    counselors: 'ssw_counselors',
    appointments: 'ssw_appointments',
    schedule: 'ssw_weekly_schedule',
    label: 'Schulsozialarbeit',
  },
};

// PUT /api/admin/users/:id/modules
router.put('/users/:id/modules', requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const { modules, force } = req.body || {};
  if (!Array.isArray(modules)) {
    return res.status(400).json({ error: 'modules must be an array of module keys' });
  }

  // Validate module keys
  const invalid = modules.filter(m => !VALID_MODULE_KEYS.includes(m));
  if (invalid.length > 0) {
    return res.status(400).json({ error: 'Invalid module keys: ' + invalid.join(', ') });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Determine which modules are being removed
    const { rows: currentRows } = await client.query(
      'SELECT module_key FROM user_module_access WHERE user_id = $1',
      [userId]
    );
    const currentKeys = currentRows.map(r => r.module_key);
    const removedKeys = currentKeys.filter(k => !modules.includes(k));

    // Check for counselor data conflicts on removed modules
    // NOTE: Table names in COUNSELOR_TABLES are static constants, never from user input.
    const conflicts = [];
    for (const key of removedKeys) {
      const cfg = COUNSELOR_TABLES[key];
      if (!cfg) continue;
      assertSafeIdentifier(cfg.appointments);
      assertSafeIdentifier(cfg.counselors);
      assertSafeIdentifier(cfg.schedule);

      const { rows: stats } = await client.query(
        `SELECT c.id,
                (SELECT COUNT(*) FROM ${cfg.appointments} a WHERE a.counselor_id = c.id AND a.status NOT IN ('cancelled', 'available')) AS appointment_count,
                (SELECT COUNT(*) FROM ${cfg.schedule} s WHERE s.counselor_id = c.id AND s.active = true) AS schedule_count
         FROM ${cfg.counselors} c WHERE c.user_id = $1`,
        [userId]
      );

      if (stats.length > 0) {
        const row = stats[0];
        const appointmentCount = parseInt(row.appointment_count, 10) || 0;
        const scheduleCount = parseInt(row.schedule_count, 10) || 0;
        if (appointmentCount > 0 || scheduleCount > 0) {
          conflicts.push({
            key,
            label: cfg.label,
            appointmentCount,
            scheduleCount,
          });
        }
      }
    }

    // If conflicts exist and force is not set, rollback and return 409
    if (conflicts.length > 0 && force !== true) {
      await client.query('ROLLBACK');
      return res.status(409).json({ conflict: true, revokedModules: conflicts });
    }

    // Clean up counselor data for removed modules
    for (const key of removedKeys) {
      const cfg = COUNSELOR_TABLES[key];
      if (!cfg) continue;
      // CASCADE on bl_counselors.id deletes appointments, schedule, requests
      await client.query(`DELETE FROM ${cfg.counselors} WHERE user_id = $1`, [userId]);
    }

    await client.query('DELETE FROM user_module_access WHERE user_id = $1', [userId]);
    for (const moduleKey of modules) {
      await client.query(
        'INSERT INTO user_module_access (user_id, module_key) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, moduleKey]
      );
    }
    await client.query('COMMIT');

    return res.json({ success: true, modules });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error({ err: error }, 'Error updating user modules');
    return res.status(500).json({ error: 'Failed to update user modules' });
  } finally {
    client.release();
  }
});

export default router;
