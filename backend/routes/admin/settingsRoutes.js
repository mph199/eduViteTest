import express from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { db } from '../../db/database.js';
import logger from '../../config/logger.js';

const router = express.Router();

// GET /api/admin/settings
router.get('/settings', requireAdmin, async (_req, res) => {
  try {
    const data = await db.selectFrom('settings')
      .selectAll()
      .limit(1)
      .executeTakeFirst();

    if (!data) {
      return res.json({
        id: 1,
        event_name: 'Elternsprechtag',
        event_date: new Date().toISOString().split('T')[0],
      });
    }

    res.json(data);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching settings');
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

    const settings = await db.insertInto('settings')
      .values({
        id: 1,
        event_name: event_name.trim(),
        event_date,
        updated_at: new Date(),
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          event_name: event_name.trim(),
          event_date,
          updated_at: new Date(),
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    res.json({ success: true, settings });
  } catch (error) {
    logger.error({ err: error }, 'Error updating settings');
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
