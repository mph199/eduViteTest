/**
 * Public ICS-Feed-Route für Kalender-Abos.
 *
 * GET /api/calendar/:token/elternsprechtag.ics
 *
 * Authentifizierung ausschließlich über Token in URL (kein JWT-Cookie).
 */

import express from 'express';
import crypto from 'crypto';
import { db } from '../../../db/database.js';
import logger from '../../../config/logger.js';
import { generateTeacherICS } from '../utils/icalGenerator.js';
import { getExpiresAt } from '../../../shared/tokenUtils.js';
import { writeAuditLog } from '../../../middleware/audit-log.js';

const router = express.Router();

const CALENDAR_UID_DOMAIN = process.env.CALENDAR_UID_DOMAIN || 'calendar.schule.de';

router.get('/:token/elternsprechtag.ics', async (req, res) => {
  try {
    const rawToken = req.params.token;
    if (!rawToken || !/^[0-9a-f]{64}$/.test(rawToken)) return res.status(404).end();

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const teacher = await db.selectFrom('teachers')
      .select(['id', 'first_name', 'last_name', 'name', 'calendar_token_created_at'])
      .where('calendar_token_hash', '=', tokenHash)
      .executeTakeFirst();

    if (!teacher) return res.status(404).end();

    const expiresAt = getExpiresAt(teacher.calendar_token_created_at);
    if (new Date() > expiresAt) {
      logger.info({ teacherId: teacher.id }, 'Kalender-Feed: abgelaufener Token');
      return res.status(404).end();
    }

    writeAuditLog(null, 'READ', 'slots', teacher.id, { source: 'calendar-feed', slotQuery: true }, req.ip);

    const slots = await db.selectFrom('slots')
      .select([
        'id', 'date', 'time', 'status', 'student_name', 'parent_name',
        'class_name', 'visitor_type', 'company_name', 'representative_name', 'trainee_name',
      ])
      .where('teacher_id', '=', teacher.id)
      .where('booked', '=', true)
      .where((eb) => eb.or([
        eb('status', '=', 'confirmed'),
        eb('status', 'is', null),
      ]))
      .orderBy('date')
      .orderBy('time')
      .execute();

    let eventName = 'BKSB Eltern- und Ausbildersprechtag';
    try {
      const row = await db.selectFrom('settings')
        .select('event_name')
        .executeTakeFirst();
      if (row?.event_name) eventName = row.event_name;
    } catch (err) { logger.debug({ err }, 'settings table not available, using default event name'); }

    const ics = generateTeacherICS(
      slots,
      teacher.name || `${teacher.first_name} ${teacher.last_name}`.trim(),
      eventName,
      CALENDAR_UID_DOMAIN,
    );

    logger.info({ teacherId: teacher.id, slotCount: slots.length }, 'Kalender-Feed ausgeliefert');

    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="elternsprechtag.ics"',
      'Cache-Control': 'no-store, private',
      'Pragma': 'no-cache',
      'X-Robots-Tag': 'noindex, nofollow',
    });
    return res.status(200).send(ics);
  } catch (err) {
    logger.error({ err }, 'Kalender-Feed: interner Fehler');
    return res.status(500).end();
  }
});

export default router;
