import express from 'express';
import { requireModuleAdmin } from '../../middleware/auth.js';
import { db } from '../../db/database.js';
import { mapSlotRow } from '../../utils/mappers.js';
import logger from '../../config/logger.js';

const router = express.Router();
const requireESTAdmin = requireModuleAdmin('elternsprechtag');

// GET /api/admin/slots
router.get('/slots', requireESTAdmin, async (req, res) => {
  try {
    const { teacherId, eventId, booked, limit } = req.query;

    let q = db.selectFrom('slots').selectAll().orderBy('date').orderBy('time');

    if (teacherId !== undefined) {
      const num = parseInt(String(teacherId), 10);
      if (isNaN(num)) return res.status(400).json({ error: 'teacherId must be a number' });
      q = q.where('teacher_id', '=', num);
    }

    if (eventId !== undefined) {
      const raw = String(eventId);
      if (raw === 'null') {
        q = q.where('event_id', 'is', null);
      } else {
        const num = parseInt(raw, 10);
        if (isNaN(num)) return res.status(400).json({ error: 'eventId must be a number or "null"' });
        q = q.where('event_id', '=', num);
      }
    }

    if (booked !== undefined) {
      const raw = String(booked).toLowerCase();
      if (raw !== 'true' && raw !== 'false') return res.status(400).json({ error: 'booked must be "true" or "false"' });
      q = q.where('booked', '=', raw === 'true');
    }

    const limitNum = limit !== undefined ? parseInt(String(limit), 10) : 2000;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 10000) {
      return res.status(400).json({ error: 'limit must be between 1 and 10000' });
    }
    q = q.limit(limitNum);

    const rows = await q.execute();
    return res.json({ slots: rows.map(mapSlotRow) });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching admin slots');
    return res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// POST /api/admin/slots
router.post('/slots', requireESTAdmin, async (req, res) => {
  try {
    const { teacher_id, time, date } = req.body || {};
    if (!teacher_id || !time || !date) {
      return res.status(400).json({ error: 'teacher_id, time, and date required' });
    }

    const slot = await db.insertInto('slots')
      .values({ teacher_id, time: time.trim(), date: date.trim(), booked: false })
      .returningAll()
      .executeTakeFirstOrThrow();

    res.json({ success: true, slot });
  } catch (error) {
    logger.error({ err: error }, 'Error creating slot');
    res.status(500).json({ error: 'Failed to create slot' });
  }
});

// PUT /api/admin/slots/:id
router.put('/slots/:id', requireESTAdmin, async (req, res) => {
  const slotId = parseInt(req.params.id, 10);
  if (isNaN(slotId)) return res.status(400).json({ error: 'Invalid slot ID' });

  try {
    const { time, date } = req.body || {};
    if (!time || !date) return res.status(400).json({ error: 'time and date required' });

    const slot = await db.updateTable('slots')
      .set({ time: time.trim(), date: date.trim(), updated_at: new Date() })
      .where('id', '=', slotId)
      .returningAll()
      .executeTakeFirst();

    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    res.json({ success: true, slot });
  } catch (error) {
    logger.error({ err: error }, 'Error updating slot');
    res.status(500).json({ error: 'Failed to update slot' });
  }
});

// DELETE /api/admin/slots/:id
router.delete('/slots/:id', requireESTAdmin, async (req, res) => {
  const slotId = parseInt(req.params.id, 10);
  if (isNaN(slotId)) return res.status(400).json({ error: 'Invalid slot ID' });

  try {
    await db.deleteFrom('slots').where('id', '=', slotId).execute();
    res.json({ success: true, message: 'Slot deleted successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting slot');
    res.status(500).json({ error: 'Failed to delete slot' });
  }
});

export default router;
