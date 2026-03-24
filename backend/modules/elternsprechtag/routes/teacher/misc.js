import express from 'express';
import { requireAuth } from '../../../../middleware/auth.js';
import { query } from '../../../../config/db.js';
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

    const { rows: slotData } = await query(
      'SELECT * FROM slots WHERE teacher_id = $1 ORDER BY date, time',
      [teacherId]
    );

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

    const { rows: teacherInfoRows } = await query(
      'SELECT id, name, first_name, last_name, email, salutation, subject FROM teachers WHERE id = $1',
      [teacherId]
    );
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
