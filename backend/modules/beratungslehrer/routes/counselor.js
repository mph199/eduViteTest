/**
 * Beratungslehrer – Berater-Routen (authentifiziert)
 *
 * Uses the shared counselor route factory for common endpoints,
 * adds BL-specific routes: profile, schedule GET/PUT.
 */

import express from 'express';
import { requireAuth, hasModuleAccess } from '../../../middleware/auth.js';
import { db } from '../../../db/database.js';
import { upsertWeeklySchedule } from '../../../shared/counselorService.js';
import { createCounselorRoutes } from '../../../shared/counselorRoutes.js';
import { createCalendarTokenRoutes } from '../../../shared/calendarTokenRoutes.js';
import logger from '../../../config/logger.js';

const BL_TABLES = {
  counselorsTable: 'bl_counselors',
  appointmentsTable: 'bl_appointments',
  scheduleTable: 'bl_weekly_schedule',
  counselorLabel: 'Beratungslehrer',
};

async function resolveCounselor(req) {
  if (req.user.role === 'admin' || req.user.role === 'superadmin') {
    const counselorId = parseInt(req.query.counselor_id || req.body?.counselor_id, 10) || null;
    if (counselorId) {
      return db.selectFrom('bl_counselors').selectAll().where('id', '=', counselorId).executeTakeFirst() ?? null;
    }
    return null;
  }

  if (hasModuleAccess(req.user, 'beratungslehrer')) {
    const counselor = await db.selectFrom('bl_counselors')
      .selectAll()
      .where('user_id', '=', req.user.id)
      .where('active', '=', true)
      .executeTakeFirst();
    if (!counselor) {
      const err = new Error('Kein Beratungslehrer-Profil zugeordnet');
      err.statusCode = 403;
      throw err;
    }
    return counselor;
  }

  const err = new Error('Kein Beratungslehrer-Zugang');
  err.statusCode = 403;
  throw err;
}

const sharedRouter = createCounselorRoutes({
  tables: BL_TABLES,
  logPrefix: 'BL',
  resolveCounselor,
});

const router = express.Router();

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

router.get('/profile', requireAuth, requireBLCounselor, async (req, res) => {
  try {
    if (!req.counselor) return res.status(404).json({ error: 'Kein Beratungslehrer-Profil gefunden' });
    res.json({ counselor: req.counselor });
  } catch (err) {
    logger.error({ err }, 'BL counselor: Fehler beim Laden des Profils');
    res.status(500).json({ error: 'Fehler beim Laden des Profils' });
  }
});

router.get('/schedule', requireAuth, requireBLCounselor, async (req, res) => {
  try {
    const counselorId = req.counselor?.id;
    if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

    const schedule = await db.selectFrom('bl_weekly_schedule')
      .selectAll()
      .where('counselor_id', '=', counselorId)
      .orderBy('weekday')
      .execute();
    res.json({ schedule });
  } catch (err) {
    logger.error({ err }, 'BL counselor: Fehler beim Laden des Wochenplans');
    res.status(500).json({ error: 'Fehler beim Laden des Wochenplans' });
  }
});

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

const calendarTokenRouter = createCalendarTokenRoutes({
  table: 'bl_counselors',
  logPrefix: 'BL',
  resolveCounselorId: async (req) => {
    const counselor = await resolveCounselor(req);
    return counselor?.id || null;
  },
});
router.use('/', calendarTokenRouter);
router.use('/', sharedRouter);

export default router;
