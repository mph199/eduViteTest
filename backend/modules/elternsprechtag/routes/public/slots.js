/**
 * Public Slots + Teachers Routes
 *
 * GET /api/teachers — List all teachers (public, no PII)
 * GET /api/slots?teacherId=X — Get available time windows for a teacher
 */

import express from 'express';
import { db } from '../../../../db/database.js';
import { listTeachers } from '../../services/teachersService.js';
import { getTimeWindowsForTeacher, formatDateDE } from '../../../../utils/timeWindows.js';
import { resolveActiveEvent } from '../../../../utils/resolveActiveEvent.js';
import logger from '../../../../config/logger.js';

const router = express.Router();

router.get('/teachers', async (_req, res) => {
  try {
    const teachers = await listTeachers();
    res.json({ teachers });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching teachers');
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

router.get('/slots', async (req, res) => {
  try {
    const { teacherId, eventId } = req.query;
    if (!teacherId) return res.status(400).json({ error: 'teacherId query param required' });

    const teacherIdNum = parseInt(teacherId, 10);
    if (isNaN(teacherIdNum)) return res.status(400).json({ error: 'teacherId must be a number' });

    const teacherRow = await db.selectFrom('teachers')
      .select(['id', 'available_from', 'available_until'])
      .where('id', '=', teacherIdNum)
      .executeTakeFirst();
    if (!teacherRow) throw new Error('Teacher not found');

    let resolvedEventId = null;
    let resolvedEventStartsAt = null;
    let resolvedEventDate = null;

    if (eventId !== undefined) {
      const parsed = parseInt(String(eventId), 10);
      if (isNaN(parsed)) return res.status(400).json({ error: 'eventId must be a number' });
      resolvedEventId = parsed;
      try {
        const ev = await db.selectFrom('events')
          .select(['id', 'starts_at'])
          .where('id', '=', resolvedEventId)
          .executeTakeFirst();
        resolvedEventStartsAt = ev?.starts_at || null;
      } catch (err) { logger.debug({ err }, 'Failed to fetch event starts_at'); resolvedEventStartsAt = null; }
    } else {
      const resolved = await resolveActiveEvent();
      resolvedEventId = resolved.eventId;
      resolvedEventDate = resolved.eventDate;
    }

    const times = getTimeWindowsForTeacher(teacherRow?.available_from, teacherRow?.available_until);
    const eventDate = resolvedEventDate
      || (resolvedEventStartsAt ? formatDateDE(resolvedEventStartsAt) : null)
      || '01.01.1970';

    const publicSlots = times.map((time, idx) => ({
      id: idx + 1,
      eventId: resolvedEventId ?? undefined,
      teacherId: teacherIdNum,
      time,
      date: eventDate,
      booked: false,
    }));

    return res.json({ slots: publicSlots });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching slots');
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

export default router;
