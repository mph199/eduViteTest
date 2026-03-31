import express from 'express';
import { requireAdmin } from '../../../middleware/auth.js';
import { db } from '../../../db/database.js';
import { generateTimeSlotsForTeacher } from '../../../utils/timeWindows.js';
import { resolveActiveEvent } from '../../../utils/resolveActiveEvent.js';
import logger from '../../../config/logger.js';

const router = express.Router();

// POST /api/admin/teachers/:id/generate-slots
router.post('/teachers/:id/generate-slots', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) return res.status(400).json({ error: 'Invalid teacher ID' });

  try {
    const teacherRow = await db.selectFrom('teachers')
      .select(['id', 'available_from', 'available_until'])
      .where('id', '=', teacherId)
      .executeTakeFirst();
    if (!teacherRow) return res.status(404).json({ error: 'Teacher not found' });

    const { eventId: targetEventId, eventDate } = await resolveActiveEvent();

    const times = generateTimeSlotsForTeacher(teacherRow.available_from, teacherRow.available_until);

    let existingQuery = db.selectFrom('slots')
      .select('time')
      .where('teacher_id', '=', teacherId)
      .where('date', '=', eventDate);

    if (targetEventId === null) {
      existingQuery = existingQuery.where('event_id', 'is', null);
    } else {
      existingQuery = existingQuery.where('event_id', '=', targetEventId);
    }

    const existingSlots = await existingQuery.execute();
    const existingTimes = new Set(existingSlots.map(s => s.time));

    const inserts = [];
    let skipped = 0;
    for (const time of times) {
      if (existingTimes.has(time)) {
        skipped += 1;
        continue;
      }
      inserts.push({
        teacher_id: teacherId,
        event_id: targetEventId,
        time,
        date: eventDate,
        booked: false,
        updated_at: new Date(),
      });
    }

    if (inserts.length) {
      await db.insertInto('slots').values(inserts).execute();
    }

    return res.json({ success: true, teacherId, eventId: targetEventId, eventDate, created: inserts.length, skipped });
  } catch (error) {
    logger.error({ err: error }, 'Error generating slots for teacher');
    return res.status(500).json({ error: 'Failed to generate slots for teacher' });
  }
});

export default router;
