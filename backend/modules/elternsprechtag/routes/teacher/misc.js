import express from 'express';
import { requireAuth } from '../../../../middleware/auth.js';
import { db } from '../../../../db/database.js';
import { mapSlotRow } from '../../../../utils/mappers.js';
import logger from '../../../../config/logger.js';
import { requireTeacher } from './lib/middleware.js';

const router = express.Router();

/**
 * GET /api/teacher/slots
 */
router.get('/slots', requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.teacherId;

    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const slotData = await db.selectFrom('slots')
      .selectAll()
      .where('teacher_id', '=', teacherId)
      .orderBy('date')
      .orderBy('time')
      .execute();

    const slots = (slotData || []).map(mapSlotRow);

    res.json({ slots });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching teacher slots');
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

/**
 * GET /api/teacher/info
 */
router.get('/info', requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.teacherId;

    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const teacherInfoRows = await db.selectFrom('teachers')
      .select(['id', 'name', 'first_name', 'last_name', 'email', 'salutation', 'subject'])
      .where('id', '=', teacherId)
      .execute();
    const data = teacherInfoRows[0];

    if (!data) throw new Error('Teacher not found');

    res.json({
      teacher: {
        id: data.id,
        name: data.name,
        email: data.email,
        salutation: data.salutation,
        subject: data.subject,
        available_from: data.available_from,
        available_until: data.available_until,
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching teacher info');
    res.status(500).json({ error: 'Failed to fetch teacher info' });
  }
});

export default router;
