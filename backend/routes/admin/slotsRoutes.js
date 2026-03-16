import express from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { query } from '../../config/db.js';
import { mapSlotRow } from '../../utils/mappers.js';

const router = express.Router();

// GET /api/admin/slots
router.get('/slots', requireAdmin, async (req, res) => {
  try {
    const { teacherId, eventId, booked, limit } = req.query;

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (teacherId !== undefined) {
      const teacherIdNum = parseInt(String(teacherId), 10);
      if (isNaN(teacherIdNum)) {
        return res.status(400).json({ error: 'teacherId must be a number' });
      }
      conditions.push(`teacher_id = $${paramIdx++}`);
      params.push(teacherIdNum);
    }

    if (eventId !== undefined) {
      const raw = String(eventId);
      if (raw === 'null') {
        conditions.push('event_id IS NULL');
      } else {
        const eventIdNum = parseInt(raw, 10);
        if (isNaN(eventIdNum)) {
          return res.status(400).json({ error: 'eventId must be a number or "null"' });
        }
        conditions.push(`event_id = $${paramIdx++}`);
        params.push(eventIdNum);
      }
    }

    if (booked !== undefined) {
      const raw = String(booked).toLowerCase();
      if (raw !== 'true' && raw !== 'false') {
        return res.status(400).json({ error: 'booked must be "true" or "false"' });
      }
      conditions.push(`booked = $${paramIdx++}`);
      params.push(raw === 'true');
    }

    const limitNum = limit !== undefined ? parseInt(String(limit), 10) : 2000;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 10000) {
      return res.status(400).json({ error: 'limit must be between 1 and 10000' });
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT * FROM slots ${whereClause} ORDER BY date, time LIMIT $${paramIdx}`,
      [...params, limitNum]
    );

    return res.json({ slots: (rows || []).map(mapSlotRow) });
  } catch (error) {
    console.error('Error fetching admin slots:', error);
    return res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// POST /api/admin/slots
router.post('/slots', requireAdmin, async (req, res) => {
  try {
    const { teacher_id, time, date } = req.body || {};

    if (!teacher_id || !time || !date) {
      return res.status(400).json({ error: 'teacher_id, time, and date required' });
    }

    const { rows } = await query(
      `INSERT INTO slots (teacher_id, time, date, booked) VALUES ($1, $2, $3, false) RETURNING *`,
      [teacher_id, time.trim(), date.trim()]
    );

    res.json({ success: true, slot: rows[0] });
  } catch (error) {
    console.error('Error creating slot:', error);
    res.status(500).json({ error: 'Failed to create slot' });
  }
});

// PUT /api/admin/slots/:id
router.put('/slots/:id', requireAdmin, async (req, res) => {
  const slotId = parseInt(req.params.id, 10);
  if (isNaN(slotId)) {
    return res.status(400).json({ error: 'Invalid slot ID' });
  }

  try {
    const { time, date } = req.body || {};

    if (!time || !date) {
      return res.status(400).json({ error: 'time and date required' });
    }

    const { rows } = await query(
      `UPDATE slots SET time = $1, date = $2, updated_at = $3 WHERE id = $4 RETURNING *`,
      [time.trim(), date.trim(), new Date().toISOString(), slotId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    res.json({ success: true, slot: rows[0] });
  } catch (error) {
    console.error('Error updating slot:', error);
    res.status(500).json({ error: 'Failed to update slot' });
  }
});

// DELETE /api/admin/slots/:id
router.delete('/slots/:id', requireAdmin, async (req, res) => {
  const slotId = parseInt(req.params.id, 10);
  if (isNaN(slotId)) {
    return res.status(400).json({ error: 'Invalid slot ID' });
  }

  try {
    await query('DELETE FROM slots WHERE id = $1', [slotId]);
    res.json({ success: true, message: 'Slot deleted successfully' });
  } catch (error) {
    console.error('Error deleting slot:', error);
    res.status(500).json({ error: 'Failed to delete slot' });
  }
});

export default router;
