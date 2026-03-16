import express from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { query } from '../../config/db.js';
import logger from '../../config/logger.js';

const router = express.Router();

// GET /api/admin/feedback
router.get('/feedback', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query('SELECT id, message, created_at FROM feedback ORDER BY created_at DESC LIMIT 200');
    return res.json({ feedback: rows });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching feedback');
    return res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// DELETE /api/admin/feedback/:id
router.delete('/feedback/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid feedback id' });
  }

  try {
    const { rows } = await query('DELETE FROM feedback WHERE id = $1 RETURNING id', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    return res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting feedback');
    return res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

export default router;
