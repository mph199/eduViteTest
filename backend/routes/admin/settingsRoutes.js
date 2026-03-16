import express from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { query } from '../../config/db.js';

const router = express.Router();

// GET /api/admin/settings
router.get('/settings', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM settings LIMIT 1');
    const data = rows[0] || null;

    if (!data) {
      return res.json({
        id: 1,
        event_name: 'Elternsprechtag',
        event_date: new Date().toISOString().split('T')[0]
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/admin/settings
router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const { event_name, event_date } = req.body || {};

    if (!event_name || !event_date) {
      return res.status(400).json({ error: 'event_name and event_date required' });
    }

    const { rows } = await query(
      `INSERT INTO settings (id, event_name, event_date, updated_at) VALUES (1, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET event_name = $1, event_date = $2, updated_at = $3
       RETURNING *`,
      [event_name.trim(), event_date, new Date().toISOString()]
    );

    res.json({ success: true, settings: rows[0] });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
