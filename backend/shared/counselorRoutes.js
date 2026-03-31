/**
 * Shared factory for authenticated counselor routes (SSW + BL).
 *
 * Creates routes for: appointments listing, slot generation,
 * confirm, and cancel. Module-specific extras (profile, schedule)
 * can be added to the returned router.
 */

import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../config/db.js';

import { generateSlotsForDateRange } from './counselorService.js';
import logger from '../config/logger.js';

/**
 * @param {object} config
 * @param {object} config.tables  – { counselorsTable, appointmentsTable, scheduleTable, counselorLabel }
 * @param {string} config.logPrefix – e.g. "SSW" or "BL"
 * @param {function} config.resolveCounselor – async (req) => counselor | null; throws {statusCode, message} on deny
 */
export function createCounselorRoutes(config) {
  const { tables, logPrefix, resolveCounselor } = config;
  const router = express.Router();

  // Middleware: resolve counselor for every route
  async function requireCounselor(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Nicht angemeldet' });
    try {
      const counselor = await resolveCounselor(req);
      req.counselor = counselor;
      next();
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      logger.error({ err }, `${logPrefix} requireCounselor error`);
      return res.status(500).json({ error: 'Interner Fehler bei Berechtigungsprüfung' });
    }
  }

  // GET /appointments
  router.get('/appointments', requireAuth, requireCounselor, async (req, res) => {
    try {
      const counselorId = req.counselor?.id;
      if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

      const params = [counselorId];
      let filters = '';
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;

      const { date, date_from, date_until, status } = req.query;

      if (date && dateRe.test(String(date))) {
        params.push(String(date));
        filters += ` AND a.date = $${params.length}`;
      }
      if (date_from && dateRe.test(String(date_from))) {
        params.push(String(date_from));
        filters += ` AND a.date >= $${params.length}`;
      }
      if (date_until && dateRe.test(String(date_until))) {
        params.push(String(date_until));
        filters += ` AND a.date <= $${params.length}`;
      }
      if (status && typeof status === 'string') {
        const allowed = ['available', 'requested', 'confirmed', 'cancelled', 'completed'];
        const statuses = status.split(',').filter(s => allowed.includes(s));
        if (statuses.length > 0) {
          const placeholders = statuses.map(s => { params.push(s); return `$${params.length}`; }).join(', ');
          filters += ` AND a.status IN (${placeholders})`;
        }
      }

      const { rows } = await query(
        `SELECT a.*
         FROM ${tables.appointmentsTable} a
         WHERE a.counselor_id = $1 ${filters}
         ORDER BY a.date, a.time`,
        params
      );
      res.json({ appointments: rows });
    } catch (err) {
      logger.error({ err }, `${logPrefix}: Fehler beim Laden der Termine`);
      res.status(500).json({ error: 'Fehler beim Laden der Termine' });
    }
  });

  // POST /generate-slots
  router.post('/generate-slots', requireAuth, requireCounselor, async (req, res) => {
    try {
      const counselorId = req.counselor?.id;
      if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

      const { date_from, date_until, exclude_weekends = true } = req.body || {};
      if (!date_from || !/^\d{4}-\d{2}-\d{2}$/.test(date_from)) {
        return res.status(400).json({ error: 'date_from im Format YYYY-MM-DD erforderlich' });
      }

      const result = await generateSlotsForDateRange(counselorId, { date_from, date_until, exclude_weekends }, tables);
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) return res.status(err.statusCode).json({ error: err.message });
      logger.error({ err }, `${logPrefix} generate-slots error`);
      res.status(500).json({ error: 'Fehler beim Erstellen der Termine' });
    }
  });

  // PUT /appointments/:id/confirm
  router.put('/appointments/:id/confirm', requireAuth, requireCounselor, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const counselorId = req.counselor?.id;
      if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

      const { rows } = await query(
        `UPDATE ${tables.appointmentsTable} SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status = 'requested' AND counselor_id = $2 RETURNING *`,
        [id, counselorId]
      );

      if (!rows.length) return res.status(404).json({ error: 'Termin nicht gefunden oder nicht im Status "angefragt"' });
      res.json({ success: true, appointment: rows[0] });
    } catch (err) {
      logger.error({ err }, `${logPrefix}: Fehler beim Bestaetigen`);
      res.status(500).json({ error: 'Fehler beim Bestaetigen' });
    }
  });

  // PUT /appointments/:id/cancel
  router.put('/appointments/:id/cancel', requireAuth, requireCounselor, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const counselorId = req.counselor?.id;
      if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

      const { rows } = await query(
        `UPDATE ${tables.appointmentsTable}
         SET status = 'cancelled',
             first_name = NULL,
             last_name = NULL,
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
      logger.error({ err }, `${logPrefix}: Fehler beim Absagen`);
      res.status(500).json({ error: 'Fehler beim Absagen' });
    }
  });

  return router;
}
