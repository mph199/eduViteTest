/**
 * Beratungslehrer – Berater-Routen (authentifiziert)
 *
 * Endpunkte für Beratungslehrer: eigene Termine verwalten,
 * Anfragen bestätigen/absagen, Notizen pflegen.
 */

import express from 'express';
import { requireAuth, hasModuleAccess } from '../../../middleware/auth.js';
import { query } from '../../../config/db.js';
import { generateSlotsForDateRange, upsertWeeklySchedule } from '../../../shared/counselorService.js';
import logger from '../../../config/logger.js';

const BL_TABLES = {
  counselorsTable: 'bl_counselors',
  appointmentsTable: 'bl_appointments',
  scheduleTable: 'bl_weekly_schedule',
  counselorLabel: 'Beratungslehrer',
};

const router = express.Router();

/**
 * Middleware: resolve counselor from authenticated user.
 */
async function requireBLCounselor(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Nicht angemeldet' });

  try {
    // Admin/Superadmin: can access any counselor by ID
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      const counselorId = parseInt(req.query.counselor_id || req.body?.counselor_id, 10) || null;
      if (counselorId) {
        const { rows } = await query('SELECT * FROM bl_counselors WHERE id = $1', [counselorId]);
        req.counselor = rows[0] || null;
      }
      return next();
    }

    // Users with beratungslehrer module access: only own counselor profile
    if (hasModuleAccess(req.user, 'beratungslehrer')) {
      const { rows } = await query('SELECT * FROM bl_counselors WHERE user_id = $1 AND active = TRUE', [req.user.id]);
      if (!rows.length) return res.status(403).json({ error: 'Kein Beratungslehrer-Profil zugeordnet' });
      req.counselor = rows[0];
      return next();
    }

    // No access
    return res.status(403).json({ error: 'Kein Beratungslehrer-Zugang' });
  } catch (err) {
    logger.error({ err }, 'requireBLCounselor error');
    return res.status(500).json({ error: 'Interner Fehler bei Berechtigungsprüfung' });
  }
}

// GET /api/bl/counselor/profile — own counselor profile
router.get('/profile', requireAuth, requireBLCounselor, async (req, res) => {
  try {
    const counselor = req.counselor;
    if (!counselor) return res.status(404).json({ error: 'Kein Beratungslehrer-Profil gefunden' });
    res.json({ counselor });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden des Profils' });
  }
});

// GET /api/bl/counselor/schedule — own weekly schedule
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
    res.status(500).json({ error: 'Fehler beim Laden des Wochenplans' });
  }
});

// PUT /api/bl/counselor/schedule — update own weekly schedule
router.put('/schedule', requireAuth, requireBLCounselor, async (req, res) => {
  try {
    const counselorId = req.counselor?.id;
    if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

    const { schedule } = req.body || {};
    const rows = await upsertWeeklySchedule(counselorId, schedule, 'bl_weekly_schedule', { minDay: 1, maxDay: 5 });
    res.json({ success: true, schedule: rows });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    logger.error({ err }, 'BL counselor schedule update error');
    res.status(500).json({ error: 'Fehler beim Speichern des Wochenplans' });
  }
});

// GET /api/bl/counselor/appointments?date=YYYY-MM-DD or ?date_from=&date_until= — own appointments
router.get('/appointments', requireAuth, requireBLCounselor, async (req, res) => {
  try {
    const counselorId = req.counselor?.id;
    if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

    const { date, date_from, date_until, status } = req.query;
    let dateFilter = '';
    const params = [counselorId];
    let pIdx = 2;

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      dateFilter += ` AND a.date = $${pIdx}`;
      params.push(date);
      pIdx++;
    } else if (date_from && date_until) {
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRe.test(String(date_from)) || !dateRe.test(String(date_until))) {
        return res.status(400).json({ error: 'Ungültiges Datumsformat (YYYY-MM-DD erwartet)' });
      }
      dateFilter += ` AND a.date >= $${pIdx} AND a.date <= $${pIdx + 1}`;
      params.push(date_from, date_until);
      pIdx += 2;
    }

    if (status && typeof status === 'string') {
      const allowed = ['available', 'requested', 'confirmed', 'cancelled', 'completed'];
      const statuses = status.split(',').filter(s => allowed.includes(s));
      if (statuses.length > 0) {
        const placeholders = statuses.map((_, i) => `$${pIdx + i}`).join(', ');
        dateFilter += ` AND a.status IN (${placeholders})`;
        params.push(...statuses);
      }
    }

    const { rows } = await query(
      `SELECT a.*, t.name AS topic_name
       FROM bl_appointments a
       LEFT JOIN bl_topics t ON t.id = a.topic_id
       WHERE a.counselor_id = $1 ${dateFilter}
       ORDER BY a.date, a.time`,
      params
    );
    res.json({ appointments: rows });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Termine' });
  }
});

// POST /api/bl/counselor/generate-slots — generate available slots for a date range
router.post('/generate-slots', requireAuth, requireBLCounselor, async (req, res) => {
  try {
    const counselorId = req.counselor?.id;
    if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

    const { date_from, date_until, exclude_weekends = true } = req.body || {};
    if (!date_from || !/^\d{4}-\d{2}-\d{2}$/.test(date_from)) {
      return res.status(400).json({ error: 'date_from im Format YYYY-MM-DD erforderlich' });
    }

    const result = await generateSlotsForDateRange(counselorId, { date_from, date_until, exclude_weekends }, BL_TABLES);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode && err.statusCode < 500) return res.status(err.statusCode).json({ error: err.message });
    logger.error({ err }, 'BL generate-slots error');
    res.status(500).json({ error: 'Fehler beim Erstellen der Termine' });
  }
});

// PUT /api/bl/counselor/appointments/:id/confirm
router.put('/appointments/:id/confirm', requireAuth, requireBLCounselor, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const counselorId = req.counselor?.id;
    if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

    const { rows } = await query(
      `UPDATE bl_appointments SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'requested' AND counselor_id = $2 RETURNING *`,
      [id, counselorId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Termin nicht gefunden oder nicht im Status "angefragt"' });
    res.json({ success: true, appointment: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Bestaetigen' });
  }
});

// PUT /api/bl/counselor/appointments/:id/cancel
router.put('/appointments/:id/cancel', requireAuth, requireBLCounselor, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const counselorId = req.counselor?.id;
    if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

    const { rows } = await query(
      `UPDATE bl_appointments
       SET status = 'cancelled',
           student_name = NULL,
           student_class = NULL,
           email = NULL,
           phone = NULL,
           updated_at = NOW()
       WHERE id = $1 AND status IN ('requested', 'confirmed', 'available') AND counselor_id = $2 RETURNING *`,
      [id, counselorId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Termin nicht gefunden' });
    res.json({ success: true, appointment: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Absagen' });
  }
});

export default router;
