/**
 * Schulsozialarbeit – Berater-Routen (authentifiziert)
 *
 * Shared counselor routes + calendar token management +
 * self-service profile/schedule endpoints.
 */

import express from 'express';
import { requireAuth, hasModuleAccess } from '../../../middleware/auth.js';
import { db } from '../../../db/database.js';
import { upsertWeeklySchedule } from '../../../shared/counselorService.js';
import { createCounselorRoutes } from '../../../shared/counselorRoutes.js';
import { createCalendarTokenRoutes } from '../../../shared/calendarTokenRoutes.js';
import logger from '../../../config/logger.js';

const SSW_TABLES = {
  counselorsTable: 'ssw_counselors',
  appointmentsTable: 'ssw_appointments',
  scheduleTable: 'ssw_weekly_schedule',
  counselorLabel: 'Berater/in',
};

async function resolveCounselor(req) {
  if (req.user.role === 'admin' || req.user.role === 'superadmin' || hasModuleAccess(req.user, 'schulsozialarbeit')) {
    const counselorId = parseInt(req.query.counselor_id || req.body?.counselor_id, 10) || null;
    if (counselorId) {
      return db.selectFrom('ssw_counselors').selectAll().where('id', '=', counselorId).executeTakeFirst() ?? null;
    }
    // Fall through: if no counselor_id given, try to resolve by user_id
  }

  const counselor = await db.selectFrom('ssw_counselors')
    .selectAll()
    .where('user_id', '=', req.user.id)
    .where('active', '=', true)
    .executeTakeFirst();

  if (!counselor) {
    const err = new Error('Kein Berater-Zugang');
    err.statusCode = 403;
    throw err;
  }
  return counselor;
}

const sharedRouter = createCounselorRoutes({
  tables: SSW_TABLES,
  logPrefix: 'SSW',
  resolveCounselor,
});

const calendarTokenRouter = createCalendarTokenRoutes({
  table: 'ssw_counselors',
  logPrefix: 'SSW',
  resolveCounselorId: async (req) => {
    const counselor = await resolveCounselor(req);
    return counselor?.id || null;
  },
});

const router = express.Router();

// ── Self-service middleware ──────────────────────────────────────────

async function requireSSWCounselor(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Nicht angemeldet' });
  try {
    req.counselor = await resolveCounselor(req);
    next();
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    logger.error({ err }, 'SSW requireCounselor error');
    return res.status(500).json({ error: 'Interner Fehler bei Berechtigungsprüfung' });
  }
}

// ── GET /profile ────────────────────────────────────────────────────

router.get('/profile', requireAuth, requireSSWCounselor, async (req, res) => {
  try {
    if (!req.counselor) return res.status(404).json({ error: 'Kein Berater-Profil gefunden' });
    res.json({ counselor: req.counselor });
  } catch (err) {
    logger.error({ err }, 'SSW counselor: Fehler beim Laden des Profils');
    res.status(500).json({ error: 'Fehler beim Laden des Profils' });
  }
});

// ── GET /schedule ───────────────────────────────────────────────────

router.get('/schedule', requireAuth, requireSSWCounselor, async (req, res) => {
  try {
    const counselorId = req.counselor?.id;
    if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

    const schedule = await db.selectFrom('ssw_weekly_schedule')
      .selectAll()
      .where('counselor_id', '=', counselorId)
      .orderBy('weekday')
      .execute();
    res.json({ schedule });
  } catch (err) {
    logger.error({ err }, 'SSW counselor: Fehler beim Laden des Wochenplans');
    res.status(500).json({ error: 'Fehler beim Laden des Wochenplans' });
  }
});

// ── PUT /schedule ───────────────────────────────────────────────────

router.put('/schedule', requireAuth, requireSSWCounselor, async (req, res) => {
  try {
    const counselorId = req.counselor?.id;
    if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

    const { schedule } = req.body || {};
    const rows = await upsertWeeklySchedule(counselorId, schedule, 'ssw_weekly_schedule', { minDay: 1, maxDay: 5 });
    res.json({ success: true, schedule: rows });
  } catch (err) {
    if (err.statusCode && err.statusCode < 500) return res.status(err.statusCode).json({ error: err.message });
    logger.error({ err }, 'SSW counselor schedule update error');
    res.status(500).json({ error: 'Fehler beim Speichern des Wochenplans' });
  }
});

router.use('/', calendarTokenRouter);
router.use('/', sharedRouter);

export default router;
