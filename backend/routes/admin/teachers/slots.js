import express from 'express';
import { requireAdmin } from '../../../middleware/auth.js';
import { query } from '../../../config/db.js';
import { generateTimeSlotsForTeacher } from '../../../utils/timeWindows.js';
import { resolveActiveEvent } from '../../../utils/resolveActiveEvent.js';
import logger from '../../../config/logger.js';

const router = express.Router();

// POST /api/admin/teachers/:id/generate-slots
router.post('/teachers/:id/generate-slots', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }

  try {
    const { rows: teacherRows } = await query('SELECT id, available_from, available_until FROM teachers WHERE id = $1', [teacherId]);
    const teacherRow = teacherRows[0];
    if (!teacherRow) return res.status(404).json({ error: 'Teacher not found' });

    const { eventId: targetEventId, eventDate } = await resolveActiveEvent();

    const times = generateTimeSlotsForTeacher(teacherRow.available_from, teacherRow.available_until);
    const now = new Date().toISOString();

    // Avoid duplicates
    let existingConditions = 'teacher_id = $1 AND date = $2';
    let existingParams = [teacherId, eventDate];
    if (targetEventId === null) {
      existingConditions += ' AND event_id IS NULL';
    } else {
      existingConditions += ' AND event_id = $3';
      existingParams.push(targetEventId);
    }

    const { rows: existingSlots } = await query(
      `SELECT time FROM slots WHERE ${existingConditions}`,
      existingParams
    );
    const existingTimes = new Set((existingSlots || []).map((s) => s.time));

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
        updated_at: now,
      });
    }

    if (inserts.length) {
      const values = inserts.map((ins, i) => {
        const base = i * 6;
        return `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}, $${base+6})`;
      }).join(', ');
      const flatParams = inserts.flatMap(ins => [
        ins.teacher_id, ins.event_id, ins.time, ins.date, ins.booked, ins.updated_at
      ]);
      await query(
        `INSERT INTO slots (teacher_id, event_id, time, date, booked, updated_at) VALUES ${values}`,
        flatParams
      );
    }

    return res.json({ success: true, teacherId, eventId: targetEventId, eventDate, created: inserts.length, skipped });
  } catch (error) {
    logger.error({ err: error }, 'Error generating slots for teacher');
    return res.status(500).json({ error: 'Failed to generate slots for teacher' });
  }
});

export default router;
