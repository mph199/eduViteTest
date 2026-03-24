/**
 * Public ICS-Feed-Route für Kalender-Abos.
 *
 * GET /api/calendar/:token/elternsprechtag.ics
 *
 * Authentifizierung ausschließlich über Token in URL (kein JWT-Cookie).
 * Aktuell nur für Eltern- und Ausbildersprechtag.
 */

import express from 'express';
import crypto from 'crypto';
import { query } from '../../../config/db.js';
import logger from '../../../config/logger.js';
import { generateTeacherICS } from '../utils/icalGenerator.js';

const router = express.Router();

const CALENDAR_UID_DOMAIN = process.env.CALENDAR_UID_DOMAIN || 'calendar.schule.de';

/**
 * Berechnet expiresAt via echter Monatsarithmetik (nicht 365 Tage).
 */
function getExpiresAt(createdAt) {
  const d = new Date(createdAt);
  d.setMonth(d.getMonth() + 12);
  return d;
}

/**
 * GET /api/calendar/:token/elternsprechtag.ics
 */
router.get('/:token/elternsprechtag.ics', async (req, res) => {
  try {
    const rawToken = req.params.token;
    if (!rawToken || rawToken.length !== 64) {
      return res.status(404).end();
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const { rows: teacherRows } = await query(
      `SELECT id, first_name, last_name, name, room, calendar_token_created_at
       FROM teachers
       WHERE calendar_token_hash = $1`,
      [tokenHash]
    );

    const teacher = teacherRows[0];
    if (!teacher) {
      return res.status(404).end();
    }

    // Ablaufprüfung: echte 12-Monats-Berechnung
    const expiresAt = getExpiresAt(teacher.calendar_token_created_at);
    if (new Date() > expiresAt) {
      logger.info({ teacherId: teacher.id }, 'Kalender-Feed: abgelaufener Token');
      return res.status(404).end();
    }

    // Bestätigte Slots laden (confirmed oder Legacy-Slots ohne Status)
    const { rows: slots } = await query(
      `SELECT
         s.id,
         s.date,
         s.time,
         s.status,
         s.student_name,
         s.parent_name,
         s.class_name,
         s.visitor_type,
         s.company_name,
         s.representative_name,
         s.trainee_name
       FROM slots s
       WHERE s.teacher_id = $1
         AND s.booked = true
         AND (s.status = 'confirmed' OR s.status IS NULL)
       ORDER BY s.date, s.time`,
      [teacher.id]
    );

    // Event-Name aus Settings laden (optional)
    let eventName = 'BKSB Eltern- und Ausbildersprechtag';
    try {
      const { rows: settingsRows } = await query(
        `SELECT value FROM settings WHERE key = 'event_name' LIMIT 1`
      );
      if (settingsRows[0]?.value) {
        eventName = settingsRows[0].value;
      }
    } catch {
      // Settings-Tabelle fehlt oder Fehler — Default verwenden
    }

    const ics = generateTeacherICS(
      slots,
      teacher.name || `${teacher.first_name} ${teacher.last_name}`.trim(),
      teacher.room,
      eventName,
      CALENDAR_UID_DOMAIN
    );

    logger.info({ teacherId: teacher.id, slotCount: slots.length }, 'Kalender-Feed ausgeliefert');

    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="elternsprechtag.ics"',
      'Cache-Control': 'no-store, max-age=0',
      'Pragma': 'no-cache',
      'X-Robots-Tag': 'noindex',
    });
    return res.status(200).send(ics);
  } catch (err) {
    logger.error({ err }, 'Kalender-Feed: interner Fehler');
    return res.status(500).end();
  }
});

export default router;
