/**
 * Public Event Routes
 *
 * GET /api/events/active — Currently active published event
 * GET /api/events/upcoming — Next 3 upcoming published events
 */

import express from 'express';
import { db } from '../../../../db/database.js';
import logger from '../../../../config/logger.js';

const router = express.Router();

router.get('/events/active', async (_req, res) => {
  try {
    const now = new Date().toISOString();
    const activeEvent = await db.selectFrom('events')
      .select([
        'id', 'name', 'school_year', 'starts_at', 'ends_at', 'timezone', 'status',
        'booking_opens_at', 'booking_closes_at',
      ])
      .where('status', '=', 'published')
      .where((eb) => eb.or([
        eb('booking_opens_at', 'is', null),
        eb('booking_opens_at', '<=', now),
      ]))
      .where((eb) => eb.or([
        eb('booking_closes_at', 'is', null),
        eb('booking_closes_at', '>=', now),
      ]))
      .orderBy('starts_at', 'desc')
      .limit(1)
      .executeTakeFirst() ?? null;

    res.json({ event: activeEvent });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching active event');
    res.status(500).json({ error: 'Failed to fetch active event' });
  }
});

router.get('/events/upcoming', async (_req, res) => {
  try {
    const now = new Date().toISOString();
    const events = await db.selectFrom('events')
      .select([
        'id', 'name', 'school_year', 'starts_at', 'ends_at', 'timezone', 'status',
        'booking_opens_at', 'booking_closes_at',
      ])
      .where('status', '=', 'published')
      .where('starts_at', '>=', now)
      .orderBy('starts_at', 'asc')
      .limit(3)
      .execute();

    res.json({ events });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching upcoming events');
    res.status(500).json({ error: 'Failed to fetch upcoming events' });
  }
});

export default router;
