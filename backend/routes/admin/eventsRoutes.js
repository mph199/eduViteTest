import express from 'express';
import { sql } from 'kysely';
import { requireModuleAdmin } from '../../middleware/auth.js';
import { db } from '../../db/database.js';
import { generateTimeSlotsForTeacher, formatDateDE } from '../../utils/timeWindows.js';
import logger from '../../config/logger.js';

const router = express.Router();
const requireESTAdmin = requireModuleAdmin('elternsprechtag');

// GET /api/admin/events
router.get('/events', requireESTAdmin, async (_req, res) => {
  try {
    const events = await db.selectFrom('events')
      .selectAll()
      .orderBy('starts_at', 'desc')
      .execute();
    res.json({ events });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching events');
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// POST /api/admin/events
router.post('/events', requireESTAdmin, async (req, res) => {
  try {
    const { name, school_year, starts_at, ends_at, timezone, booking_opens_at, booking_closes_at, status } = req.body || {};
    if (!name || !school_year || !starts_at || !ends_at) {
      return res.status(400).json({ error: 'name, school_year, starts_at, ends_at required' });
    }

    const event = await db.insertInto('events')
      .values({
        name,
        school_year,
        starts_at,
        ends_at,
        timezone: timezone || 'Europe/Berlin',
        status: status || 'draft',
        booking_opens_at: booking_opens_at || null,
        booking_closes_at: booking_closes_at || null,
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    res.json({ success: true, event });
  } catch (error) {
    logger.error({ err: error }, 'Error creating event');
    const msg = error?.message || '';
    if (msg.toLowerCase().includes('row-level security')) {
      return res.status(403).json({ error: 'Zugriff verweigert (RLS)' });
    }
    return res.status(500).json({ error: 'Failed to create event' });
  }
});

// PUT /api/admin/events/:id
const EVENT_UPDATABLE_FIELDS = ['name', 'school_year', 'starts_at', 'ends_at', 'timezone', 'status', 'booking_opens_at', 'booking_closes_at'];

router.put('/events/:id', requireESTAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const patch = { updated_at: new Date() };
    for (const key of EVENT_UPDATABLE_FIELDS) {
      if (req.body?.[key] !== undefined) {
        patch[key] = req.body[key];
      }
    }
    if (patch.status === 'closed') {
      patch.closed_at = new Date();
    }

    if (Object.keys(patch).length <= 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const event = await db.updateTable('events')
      .set(patch)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Auto-anonymize booking_requests when event is closed
    if (event.status === 'closed' && patch.status === 'closed') {
      try {
        const result = await sql`SELECT anonymize_booking_requests(${id}) AS affected`.execute(db);
        const anonymized = result.rows[0]?.affected || 0;
        if (anonymized > 0) {
          logger.info({ eventId: id, anonymized }, 'Auto-anonymized booking requests on event close');
        }
        return res.json({ success: true, event, anonymizedBookingRequests: anonymized });
      } catch (anonErr) {
        logger.warn({ err: anonErr, eventId: id }, 'Auto-anonymization failed, event still closed');
      }
    }

    res.json({ success: true, event });
  } catch (error) {
    logger.error({ err: error }, 'Error updating event');
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /api/admin/events/:id
router.delete('/events/:id', requireESTAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await db.deleteFrom('events').where('id', '=', id).execute();
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting event');
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// GET /api/admin/events/:id/stats
router.get('/events/:id/stats', requireESTAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const exists = await db.selectFrom('events')
      .select('id')
      .where('id', '=', eventId)
      .executeTakeFirst();
    if (!exists) return res.status(404).json({ error: 'Event not found' });

    const stats = await db.selectFrom('slots')
      .select((eb) => [
        eb.fn.countAll().as('totalSlots'),
        eb.fn.count(
          eb.case().when('booked', '=', false).then(sql`1`).end()
        ).as('availableSlots'),
        eb.fn.count(
          eb.case().when('booked', '=', true).then(sql`1`).end()
        ).as('bookedSlots'),
        eb.fn.count(
          eb.case().when('status', '=', 'reserved').then(sql`1`).end()
        ).as('reservedSlots'),
        eb.fn.count(
          eb.case().when('status', '=', 'confirmed').then(sql`1`).end()
        ).as('confirmedSlots'),
      ])
      .where('event_id', '=', eventId)
      .executeTakeFirstOrThrow();

    res.json({
      eventId,
      totalSlots: Number(stats.totalSlots) || 0,
      availableSlots: Number(stats.availableSlots) || 0,
      bookedSlots: Number(stats.bookedSlots) || 0,
      reservedSlots: Number(stats.reservedSlots) || 0,
      confirmedSlots: Number(stats.confirmedSlots) || 0,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching event stats');
    res.status(500).json({ error: 'Failed to fetch event stats' });
  }
});

// POST /api/admin/events/:id/generate-slots
router.post('/events/:id/generate-slots', requireESTAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid id' });

  const { dryRun, replaceExisting, slotMinutes: rawSlotMinutes } = req.body || {};
  const slotMinutes = [10, 15, 20, 30].includes(rawSlotMinutes) ? rawSlotMinutes : 15;

  try {
    const eventRow = await db.selectFrom('events')
      .selectAll()
      .where('id', '=', eventId)
      .executeTakeFirst();
    if (!eventRow) return res.status(404).json({ error: 'Event not found' });

    const eventDate = formatDateDE(eventRow.starts_at);
    if (!eventDate) return res.status(400).json({ error: 'Event starts_at is invalid' });

    const teacherRows = await db.selectFrom('teachers')
      .select(['id', 'available_from', 'available_until'])
      .execute();
    if (!teacherRows.length) return res.json({ success: true, created: 0, skipped: 0, eventDate });

    let created = 0;
    let skipped = 0;

    await db.transaction().execute(async (trx) => {
      if (replaceExisting && !dryRun) {
        await trx.deleteFrom('slots')
          .where('event_id', '=', eventId)
          .where('date', '=', eventDate)
          .execute();
      }

      for (const t of teacherRows) {
        const times = generateTimeSlotsForTeacher(t.available_from, t.available_until, slotMinutes);

        const existingSlots = await trx.selectFrom('slots')
          .select('time')
          .where('teacher_id', '=', t.id)
          .where('event_id', '=', eventId)
          .where('date', '=', eventDate)
          .execute();
        const existingTimes = new Set(existingSlots.map(s => s.time));

        const inserts = [];
        for (const time of times) {
          if (existingTimes.has(time)) {
            skipped += 1;
            continue;
          }
          inserts.push({
            teacher_id: t.id,
            event_id: eventId,
            date: eventDate,
            time,
            booked: false,
            updated_at: new Date(),
          });
        }

        if (inserts.length && !dryRun) {
          await trx.insertInto('slots').values(inserts).execute();
        }
        created += inserts.length;
      }
    });

    return res.json({
      success: true, eventId, eventDate, created, skipped,
      dryRun: Boolean(dryRun), replaceExisting: Boolean(replaceExisting),
    });
  } catch (error) {
    logger.error({ err: error }, 'Error generating slots for event');
    return res.status(500).json({ error: 'Failed to generate slots for event' });
  }
});

export default router;
