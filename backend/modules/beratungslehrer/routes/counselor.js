/**
 * Beratungslehrer – Berater-Routen (authentifiziert)
 *
 * Uses the shared counselor route factory for common endpoints,
 * adds BL-specific routes: profile, schedule GET/PUT.
 */

import express from 'express';
import { requireAuth, hasModuleAccess } from '../../../middleware/auth.js';
import { query } from '../../../config/db.js';
import { upsertWeeklySchedule } from '../../../shared/counselorService.js';
import { createCounselorRoutes } from '../../../shared/counselorRoutes.js';
import logger from '../../../config/logger.js';

const BL_TABLES = {
  counselorsTable: 'bl_counselors',
  appointmentsTable: 'bl_appointments',
  scheduleTable: 'bl_weekly_schedule',
  counselorLabel: 'Beratungslehrer',
};

async function resolveCounselor(req) {
  // Admin/Superadmin: can access any counselor by ID
  if (req.user.role === 'admin' || req.user.role === 'superadmin') {
    const counselorId = parseInt(req.query.counselor_id || req.body?.counselor_id, 10) || null;
    if (counselorId) {
      const { rows } = await query('SELECT * FROM bl_counselors WHERE id = $1', [counselorId]);
      return rows[0] || null;
    }
    return null;
  }

  // Users with beratungslehrer module access: only own profile
  if (hasModuleAccess(req.user, 'beratungslehrer')) {
    const { rows } = await query('SELECT * FROM bl_counselors WHERE user_id = $1 AND active = TRUE', [req.user.id]);
    if (!rows.length) {
      const err = new Error('Kein Beratungslehrer-Profil zugeordnet');
      err.statusCode = 403;
      throw err;
    }
    return rows[0];
  }

  const err = new Error('Kein Beratungslehrer-Zugang');
  err.statusCode = 403;
  throw err;
}

// Shared routes (appointments, generate-slots, confirm, cancel)
const sharedRouter = createCounselorRoutes({
  tables: BL_TABLES,
  topicJoin: '',
  topicSelect: '',
  logPrefix: 'BL',
  resolveCounselor,
});

// Compose: BL-specific routes first, then shared
const router = express.Router();

// Reusable middleware for BL-specific routes
async function requireBLCounselor(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Nicht angemeldet' });
  try {
    req.counselor = await resolveCounselor(req);
    next();
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    logger.error({ err }, 'BL requireCounselor error');
    return res.status(500).json({ error: 'Interner Fehler bei Berechtigungsprüfung' });
  }
}

// GET /profile — own counselor profile
router.get('/profile', requireAuth, requireBLCounselor, async (req, res) => {
  try {
    const counselor = req.counselor;
    if (!counselor) return res.status(404).json({ error: 'Kein Beratungslehrer-Profil gefunden' });
    res.json({ counselor });
  } catch (err) {
    logger.error({ err }, 'BL counselor: Fehler beim Laden des Profils');
    res.status(500).json({ error: 'Fehler beim Laden des Profils' });
  }
});

// GET /schedule — own weekly schedule
router.get('/schedule', requireAuth, requireBLCounselor, async (req, res) => {
  try {
    const counselorId = req.counselor?.id;
    if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

    const { rows } = await query(
      'SELECT * FROM bl_weekly_schedule WHERE counselor_id = $1 ORDER BY weekday',
      [counselorId]
    );
    res.json({ schedule: rows });
  } catch (err) {
    logger.error({ err }, 'BL counselor: Fehler beim Laden des Wochenplans');
    res.status(500).json({ error: 'Fehler beim Laden des Wochenplans' });
  }
});

// PUT /schedule — update own weekly schedule
router.put('/schedule', requireAuth, requireBLCounselor, async (req, res) => {
  try {
    const counselorId = req.counselor?.id;
    if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

    const { schedule } = req.body || {};
    const rows = await upsertWeeklySchedule(counselorId, schedule, 'bl_weekly_schedule', { minDay: 1, maxDay: 5 });
    res.json({ success: true, schedule: rows });
  } catch (err) {
    if (err.statusCode && err.statusCode < 500) return res.status(err.statusCode).json({ error: err.message });
    logger.error({ err }, 'BL counselor schedule update error');
    res.status(500).json({ error: 'Fehler beim Speichern des Wochenplans' });
  }
});

// Mount shared routes
router.use('/', sharedRouter);

export default router;
