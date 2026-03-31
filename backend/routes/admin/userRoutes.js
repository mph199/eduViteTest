import express from 'express';
import { sql } from 'kysely';
import { requireAdmin, requireSuperadmin } from '../../middleware/auth.js';
import { db } from '../../db/database.js';
import { assertSafeIdentifier } from '../../shared/sqlGuards.js';
import logger from '../../config/logger.js';

const router = express.Router();

const VALID_MODULE_KEYS = ['beratungslehrer', 'schulsozialarbeit', 'flow'];

// GET /api/admin/users
router.get('/users', requireAdmin, async (_req, res) => {
  try {
    const rows = await sql`
      SELECT u.id, u.username, u.role, u.teacher_id, u.created_at, u.updated_at,
             COALESCE(
               (SELECT json_agg(uma.module_key ORDER BY uma.module_key)
                FROM user_module_access uma WHERE uma.user_id = u.id),
               '[]'::json
             ) AS modules
      FROM users u ORDER BY u.id
    `.execute(db);
    return res.json({ users: rows.rows });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching admin users');
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

  const { role } = req.body || {};
  const roleStr = String(role || '').trim();
  if (!['admin', 'teacher'].includes(roleStr)) {
    return res.status(400).json({ error: 'role must be "admin" or "teacher"' });
  }

  try {
    if (req.user?.username) {
      const me = await db.selectFrom('users')
        .select(['id', 'role'])
        .where('username', '=', req.user.username)
        .executeTakeFirst();
      if (me && Number(me.id) === userId && roleStr !== me.role && (me.role === 'admin' || me.role === 'superadmin')) {
        return res.status(400).json({ error: 'Sie koennen Ihre eigene Rolle nicht herabstufen.' });
      }
    }

    const updated = await db.updateTable('users')
      .set({ role: roleStr })
      .where('id', '=', userId)
      .returning(['id', 'username', 'role', 'teacher_id', 'created_at', 'updated_at'])
      .executeTakeFirst();

    if (!updated) return res.status(404).json({ error: 'User not found' });
    return res.json({ success: true, user: updated });
  } catch (error) {
    logger.error({ err: error }, 'Error updating admin user role');
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// Counselor cleanup config per module key
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
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

  const { modules, force } = req.body || {};
  if (!Array.isArray(modules)) return res.status(400).json({ error: 'modules must be an array of module keys' });

  const invalid = modules.filter(m => !VALID_MODULE_KEYS.includes(m));
  if (invalid.length > 0) return res.status(400).json({ error: 'Invalid module keys: ' + invalid.join(', ') });

  try {
    await db.transaction().execute(async (trx) => {
      const currentRows = await trx.selectFrom('user_module_access')
        .select('module_key')
        .where('user_id', '=', userId)
        .execute();
      const currentKeys = currentRows.map(r => r.module_key);
      const removedKeys = currentKeys.filter(k => !modules.includes(k));

      // Check for counselor data conflicts on removed modules
      const conflicts = [];
      for (const key of removedKeys) {
        const cfg = COUNSELOR_TABLES[key];
        if (!cfg) continue;
        assertSafeIdentifier(cfg.appointments);
        assertSafeIdentifier(cfg.counselors);
        assertSafeIdentifier(cfg.schedule);

        const stats = await sql`
          SELECT c.id,
                 (SELECT COUNT(*) FROM ${sql.table(cfg.appointments)} a WHERE a.counselor_id = c.id AND a.status NOT IN ('cancelled', 'available')) AS appointment_count,
                 (SELECT COUNT(*) FROM ${sql.table(cfg.schedule)} s WHERE s.counselor_id = c.id AND s.active = true) AS schedule_count
          FROM ${sql.table(cfg.counselors)} c WHERE c.user_id = ${userId}
        `.execute(trx);

        if (stats.rows.length > 0) {
          const row = stats.rows[0];
          const appointmentCount = parseInt(row.appointment_count, 10) || 0;
          const scheduleCount = parseInt(row.schedule_count, 10) || 0;
          if (appointmentCount > 0 || scheduleCount > 0) {
            conflicts.push({ key, label: cfg.label, appointmentCount, scheduleCount });
          }
        }
      }

      if (conflicts.length > 0 && force !== true) {
        // Throwing inside transaction triggers rollback
        const err = new Error('conflict');
        err.conflicts = conflicts;
        throw err;
      }

      // Clean up counselor data for removed modules
      for (const key of removedKeys) {
        const cfg = COUNSELOR_TABLES[key];
        if (!cfg) continue;
        await sql`DELETE FROM ${sql.table(cfg.counselors)} WHERE user_id = ${userId}`.execute(trx);
      }

      await trx.deleteFrom('user_module_access').where('user_id', '=', userId).execute();
      for (const moduleKey of modules) {
        await trx.insertInto('user_module_access')
          .values({ user_id: userId, module_key: moduleKey })
          .onConflict((oc) => oc.doNothing())
          .execute();
      }
      await trx.updateTable('users')
        .set((eb) => ({ token_version: eb('token_version', '+', 1) }))
        .where('id', '=', userId)
        .execute();
    });

    return res.json({ success: true, modules });
  } catch (error) {
    if (error.conflicts) {
      return res.status(409).json({ conflict: true, revokedModules: error.conflicts });
    }
    logger.error({ err: error }, 'Error updating user modules');
    return res.status(500).json({ error: 'Failed to update user modules' });
  }
});

// ── Admin-Module-Rechte (user_admin_access) ─────────────────────

const VALID_ADMIN_MODULE_KEYS = ['elternsprechtag', 'schulsozialarbeit', 'beratungslehrer', 'flow'];

// GET /api/admin/users/:id/admin-access
router.get('/users/:id/admin-access', requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

  try {
    const rows = await db.selectFrom('user_admin_access')
      .select('module_key')
      .where('user_id', '=', userId)
      .execute();
    return res.json({ adminModules: rows.map(r => r.module_key) });
  } catch (error) {
    logger.error({ err: error }, 'Error loading admin access');
    return res.status(500).json({ error: 'Failed to load admin access' });
  }
});

// PUT /api/admin/users/:id/admin-access
router.put('/users/:id/admin-access', requireSuperadmin, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

  const { adminModules } = req.body || {};
  if (!Array.isArray(adminModules)) return res.status(400).json({ error: 'adminModules must be an array' });

  const invalid = adminModules.filter(k => !VALID_ADMIN_MODULE_KEYS.includes(k));
  if (invalid.length > 0) return res.status(400).json({ error: 'Invalid admin module keys: ' + invalid.join(', ') });

  if (adminModules.length > 0) {
    try {
      const enabledRows = await db.selectFrom('module_config')
        .select('module_id')
        .where('enabled', '=', true)
        .execute();
      const enabledSet = new Set(enabledRows.map(r => r.module_id));
      const disabled = adminModules.filter(k => !enabledSet.has(k));
      if (disabled.length > 0) {
        return res.status(400).json({
          error: `Adminrechte können nur für freigeschaltete Module vergeben werden. Deaktiviert: ${disabled.join(', ')}`,
        });
      }
    } catch (err) {
      logger.warn({ err }, 'Modulkonfiguration konnte nicht geprüft werden');
      return res.status(500).json({ error: 'Modulkonfiguration konnte nicht geprüft werden' });
    }
  }

  try {
    await db.deleteFrom('user_admin_access').where('user_id', '=', userId).execute();
    for (const moduleKey of adminModules) {
      await db.insertInto('user_admin_access')
        .values({ user_id: userId, module_key: moduleKey, granted_by: req.user.id || null })
        .onConflict((oc) => oc.doNothing())
        .execute();
    }
    await db.updateTable('users')
      .set((eb) => ({ token_version: eb('token_version', '+', 1) }))
      .where('id', '=', userId)
      .execute();

    return res.json({ success: true, adminModules });
  } catch (error) {
    logger.error({ err: error }, 'Error updating admin access');
    return res.status(500).json({ error: 'Failed to update admin access' });
  }
});

export default router;
