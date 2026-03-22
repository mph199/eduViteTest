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
      'SELECT id, name, first_name, last_name, email, salutation, subject, room FROM teachers WHERE id = $1',
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
        room: data.room
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching teacher info');
    res.status(500).json({ error: 'Failed to fetch teacher info' });
  }
});

/**
 * POST /api/teacher/feedback
 */
router.post('/feedback', requireAuth, requireTeacher, async (req, res) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
      return res.status(400).json({ error: 'Bitte eine Nachricht eingeben.' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Nachricht darf maximal 2000 Zeichen lang sein.' });
    }

    const { rows: feedbackRows } = await query(
      'INSERT INTO feedback (message) VALUES ($1) RETURNING id, message, created_at',
      [message]
    );
    const data = feedbackRows[0];

    return res.json({ success: true, feedback: data });
  } catch (error) {
    logger.error({ err: error }, 'Error creating feedback');
    return res.status(500).json({ error: 'Feedback konnte nicht gespeichert werden.' });
  }
});

export default router;
