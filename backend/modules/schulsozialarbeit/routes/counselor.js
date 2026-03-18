/**
 * Schulsozialarbeit – Berater-Routen (authentifiziert)
 *
 * Endpunkte für Berater/innen: eigene Termine verwalten,
 * Anfragen bestätigen/absagen.
 */

import express from 'express';
import { requireAuth } from '../../../middleware/auth.js';
import { query } from '../../../config/db.js';
import { generateSlotsForDateRange } from '../../../shared/counselorService.js';
import logger from '../../../config/logger.js';

const SSW_TABLES = {
  counselorsTable: 'ssw_counselors',
  appointmentsTable: 'ssw_appointments',
  scheduleTable: 'ssw_weekly_schedule',
  counselorLabel: 'Berater/in',
};

const router = express.Router();

/**
 * Middleware: resolve counselor from authenticated user.
 */
async function requireCounselor(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Nicht angemeldet' });

  try {
    // Admin/Superadmin/SSW can access all counselor routes
    if (req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.role === 'ssw') {
      const counselorId = parseInt(req.query.counselor_id || req.body?.counselor_id, 10) || null;
      if (counselorId) {
        const { rows } = await query('SELECT * FROM ssw_counselors WHERE id = $1', [counselorId]);
        req.counselor = rows[0] || null;
      }
      return next();
    }

    // For regular users, check if they are linked to a counselor
    const { rows } = await query('SELECT * FROM ssw_counselors WHERE user_id = $1 AND active = TRUE', [req.user.id]);
    if (!rows.length) return res.status(403).json({ error: 'Kein Berater-Zugang' });
    req.counselor = rows[0];
    next();
  } catch (err) {
    logger.error({ err }, 'requireCounselor error');
    return res.status(500).json({ error: 'Interner Fehler bei Berechtigungsprüfung' });
  }
}

// GET /api/ssw/counselor/appointments?date=YYYY-MM-DD — own appointments
router.get('/appointments', requireAuth, requireCounselor, async (req, res) => {
  try {
    const counselorId = req.counselor?.id;
    if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

    const date = req.query.date;
    const dateFrom = req.query.date_from;
    const dateUntil = req.query.date_until;
    const statusFilter = req.query.status;
    const params = [counselorId];
    let filters = '';

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      params.push(String(date));
      filters += ` AND a.date = $${params.length}`;
    }
    if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(String(dateFrom))) {
      params.push(String(dateFrom));
      filters += ` AND a.date >= $${params.length}`;
    }
    if (dateUntil && /^\d{4}-\d{2}-\d{2}$/.test(String(dateUntil))) {
      params.push(String(dateUntil));
      filters += ` AND a.date <= $${params.length}`;
    }
    if (statusFilter) {
      const validStatuses = ['available', 'requested', 'confirmed', 'cancelled', 'completed'];
      const statuses = String(statusFilter).split(',').filter(s => validStatuses.includes(s));
      if (statuses.length > 0) {
        const placeholders = statuses.map(s => { params.push(s); return `$${params.length}`; }).join(', ');
        filters += ` AND a.status IN (${placeholders})`;
      }
    }

    const { rows } = await query(
      `SELECT a.*, c.name AS category_name, c.icon AS category_icon
       FROM ssw_appointments a
       LEFT JOIN ssw_categories c ON c.id = a.category_id
       WHERE a.counselor_id = $1 ${filters}
       ORDER BY a.date, a.time`,
      params
    );
    res.json({ appointments: rows });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Termine' });
  }
});

// POST /api/ssw/counselor/generate-slots — generate available slots for a date range
router.post('/generate-slots', requireAuth, requireCounselor, async (req, res) => {
  try {
    const counselorId = req.counselor?.id;
    if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

    const { date_from, date_until, exclude_weekends = true } = req.body || {};
    if (!date_from || !/^\d{4}-\d{2}-\d{2}$/.test(date_from)) {
      return res.status(400).json({ error: 'date_from im Format YYYY-MM-DD erforderlich' });
    }

    const result = await generateSlotsForDateRange(counselorId, { date_from, date_until, exclude_weekends }, SSW_TABLES);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode && err.statusCode < 500) return res.status(err.statusCode).json({ error: err.message });
    logger.error({ err }, 'SSW generate-slots error');
    res.status(500).json({ error: 'Fehler beim Erstellen der Termine' });
  }
});

// PUT /api/ssw/counselor/appointments/:id/confirm — confirm a requested appointment
router.put('/appointments/:id/confirm', requireAuth, requireCounselor, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const counselorId = req.counselor?.id;
    if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

    const { rows } = await query(
      `UPDATE ssw_appointments SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'requested' AND counselor_id = $2 RETURNING *`,
      [id, counselorId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Termin nicht gefunden oder nicht im Status "angefragt"' });
    res.json({ success: true, appointment: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Bestätigen' });
  }
});

// PUT /api/ssw/counselor/appointments/:id/cancel — cancel an appointment
router.put('/appointments/:id/cancel', requireAuth, requireCounselor, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const counselorId = req.counselor?.id;
    if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

    const { rows } = await query(
      `UPDATE ssw_appointments
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
