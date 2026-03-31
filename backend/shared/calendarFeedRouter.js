/**
 * Shared Calendar-Feed-Router-Factory.
 *
 * Erzeugt Express-Router für ICS-Feed-Endpunkte. Jedes Modul registriert
 * seinen Feed über diese Factory, alle laufen unter /api/calendar mit
 * einem gemeinsamen Rate-Limiter.
 *
 * Usage in Modul-index.js:
 *   import { createCalendarFeedRoute } from '../../shared/calendarFeedRouter.js';
 *   const feedRoute = createCalendarFeedRoute({ ... });
 *   // Dann in register(): calendarRouter.use(feedRoute);
 */

import express from 'express';
import crypto from 'crypto';
import { query } from '../config/db.js';
import { db } from '../db/database.js';
import logger from '../config/logger.js';
import { getExpiresAt } from './tokenUtils.js';
import { writeAuditLog } from '../middleware/audit-log.js';
import { assertSafeIdentifier } from './sqlGuards.js';

const CALENDAR_UID_DOMAIN = process.env.CALENDAR_UID_DOMAIN || 'calendar.schule.de';

/**
 * Erzeugt einen Express-Router mit einer ICS-Feed-Route.
 *
 * @param {Object} config
 * @param {string} config.filename - ICS-Dateiname in der URL (z.B. "beratungslehrer.ics")
 * @param {string} config.table - Tabelle mit calendar_token_hash (z.B. "bl_counselors")
 * @param {string} config.appointmentTable - Tabelle mit Terminen (z.B. "bl_appointments")
 * @param {string} config.counselorIdColumn - FK-Spalte in appointmentTable (z.B. "counselor_id")
 * @param {string} config.uidPrefix - Prefix für ICS-UIDs (z.B. "bl-appointment")
 * @param {string} config.calendarTitle - Kalendertitel (z.B. "Beratungslehrer-Termine")
 * @param {string} [config.prodId] - PRODID für den ICS-Kalender
 * @param {string} config.auditResource - Audit-Log-Resource (z.B. "bl_appointments")
 * @param {Function} config.generateICS - ICS-Generator-Funktion
 * @returns {express.Router}
 */
export function createCalendarFeedRoute(config) {
  const {
    filename,
    table,
    appointmentTable,
    counselorIdColumn,
    uidPrefix,
    calendarTitle,
    prodId,
    auditResource,
    generateICS,
  } = config;

  assertSafeIdentifier(table, 'table');
  assertSafeIdentifier(appointmentTable, 'appointmentTable');
  assertSafeIdentifier(counselorIdColumn, 'counselorIdColumn');

  const router = express.Router();

  router.get(`/:token/${filename}`, async (req, res) => {
    try {
      const rawToken = req.params.token;
      if (!rawToken || !/^[0-9a-f]{64}$/.test(rawToken)) {
        return res.status(404).end();
      }

      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const { rows } = await query(
        `SELECT id, first_name, last_name, calendar_token_created_at
         FROM ${table}
         WHERE calendar_token_hash = $1`,
        [tokenHash]
      );

      const counselor = rows[0];
      if (!counselor) {
        return res.status(404).end();
      }

      const expiresAt = getExpiresAt(counselor.calendar_token_created_at);
      if (new Date() > expiresAt) {
        logger.info({ counselorId: counselor.id, table }, 'Kalender-Feed: abgelaufener Token');
        return res.status(404).end();
      }

      writeAuditLog(null, 'READ', auditResource, counselor.id, { source: 'calendar-feed' }, req.ip);

      const { rows: appointments } = await query(
        `SELECT id, date, time
         FROM ${appointmentTable}
         WHERE ${counselorIdColumn} = $1
           AND status = 'confirmed'
         ORDER BY date, time`,
        [counselor.id]
      );

      const counselorName = `${counselor.first_name} ${counselor.last_name}`.trim();

      const ics = generateICS({
        appointments,
        counselorName,
        calendarTitle,
        uidPrefix,
        uidDomain: CALENDAR_UID_DOMAIN,
        prodId,
      });

      logger.info({ counselorId: counselor.id, table, appointmentCount: appointments.length }, 'Kalender-Feed ausgeliefert');

      res.set({
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store, private',
        'Pragma': 'no-cache',
        'X-Robots-Tag': 'noindex, nofollow',
      });
      return res.status(200).send(ics);
    } catch (err) {
      logger.error({ err, table }, 'Kalender-Feed: interner Fehler');
      return res.status(500).end();
    }
  });

  return router;
}
