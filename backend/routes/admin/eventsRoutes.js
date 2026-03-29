import express from 'express';
import { requireModuleAdmin } from '../../middleware/auth.js';
import { query, getClient } from '../../config/db.js';
import { generateTimeSlotsForTeacher, formatDateDE } from '../../utils/timeWindows.js';
import logger from '../../config/logger.js';

const router = express.Router();
const requireESTAdmin = requireModuleAdmin('elternsprechtag');

// GET /api/admin/events
router.get('/events', requireESTAdmin, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM events ORDER BY starts_at DESC');
    res.json({ events: rows || [] });
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

    const { rows } = await query(
      `INSERT INTO events (name, school_year, starts_at, ends_at, timezone, status, booking_opens_at, booking_closes_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, school_year, starts_at, ends_at, timezone || 'Europe/Berlin', status || 'draft', booking_opens_at || null, booking_closes_at || null, new Date().toISOString()]
    );
    res.json({ success: true, event: rows[0] });
  } catch (error) {
    logger.error({ err: error }, 'Error creating event');
    const msg = (error && typeof error === 'object' && 'message' in error)
      ? String(error.message)
      : '';

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
    const patch = { ...(req.body || {}), updated_at: new Date().toISOString() };
    // Set closed_at when transitioning to 'closed'
    if (patch.status === 'closed') {
      patch.closed_at = new Date().toISOString();
    }
    const ALLOWED = [...EVENT_UPDATABLE_FIELDS, 'updated_at', 'closed_at'];
    const setCols = [];
    const setParams = [];
    let pi = 1;
    for (const [key, val] of Object.entries(patch)) {
      if (!ALLOWED.includes(key)) continue;
      setCols.push(`${key} = $${pi++}`);
      setParams.push(val);
    }
    if (!setCols.length) return res.status(400).json({ error: 'No fields to update' });
    setParams.push(id);
    const { rows } = await query(
      `UPDATE events SET ${setCols.join(', ')} WHERE id = $${pi} RETURNING *`,
      setParams
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });

    const event = rows[0];

    // Auto-anonymize booking_requests when event is closed
    if (event.status === 'closed' && patch.status === 'closed') {
      try {
        const { rows: anonRows } = await query(
          'SELECT anonymize_booking_requests($1) AS affected',
          [id]
        );
        const anonymized = anonRows[0]?.affected || 0;
        if (anonymized > 0) {
          logger.info({ eventId: id, anonymized }, 'Auto-anonymized booking requests on event close');
        }
        return res.json({ success: true, event, anonymizedBookingRequests: anonymized });
      } catch (anonErr) {
        // Non-fatal: event update succeeded, anonymization can be retried
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
    await query('DELETE FROM events WHERE id = $1', [id]);
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
    const { rows: eventRows } = await query('SELECT id FROM events WHERE id = $1', [eventId]);
    if (!eventRows.length) return res.status(404).json({ error: 'Event not found' });

    const [totalRes, availableRes, bookedRes, reservedRes, confirmedRes] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM slots WHERE event_id = $1', [eventId]),
      query('SELECT COUNT(*) AS count FROM slots WHERE event_id = $1 AND booked = false', [eventId]),
      query('SELECT COUNT(*) AS count FROM slots WHERE event_id = $1 AND booked = true', [eventId]),
      query(`SELECT COUNT(*) AS count FROM slots WHERE event_id = $1 AND status = 'reserved'`, [eventId]),
      query(`SELECT COUNT(*) AS count FROM slots WHERE event_id = $1 AND status = 'confirmed'`, [eventId]),
    ]);

    res.json({
      eventId,
      totalSlots: parseInt(totalRes.rows[0].count, 10) || 0,
      availableSlots: parseInt(availableRes.rows[0].count, 10) || 0,
      bookedSlots: parseInt(bookedRes.rows[0].count, 10) || 0,
      reservedSlots: parseInt(reservedRes.rows[0].count, 10) || 0,
      confirmedSlots: parseInt(confirmedRes.rows[0].count, 10) || 0,
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
    const { rows: evtRows } = await query('SELECT * FROM events WHERE id = $1', [eventId]);
    const eventRow = evtRows[0];
    if (!eventRow) return res.status(404).json({ error: 'Event not found' });

    const eventDate = formatDateDE(eventRow.starts_at);
    if (!eventDate) return res.status(400).json({ error: 'Event starts_at is invalid' });

    const { rows: teachers } = await query('SELECT id, available_from, available_until FROM teachers');
    const teacherRows = teachers || [];
    if (!teacherRows.length) return res.json({ success: true, created: 0, skipped: 0, eventDate });

    // Use transaction for atomicity (especially when replacing existing slots)
    const client = await getClient();
    let created = 0;
    let skipped = 0;

    try {
      await client.query('BEGIN');

      if (replaceExisting && !dryRun) {
        await client.query('DELETE FROM slots WHERE event_id = $1 AND date = $2', [eventId, eventDate]);
      }

      for (const t of teacherRows) {
        const times = generateTimeSlotsForTeacher(t.available_from, t.available_until, slotMinutes);

        const { rows: existingSlots } = await client.query(
          'SELECT time FROM slots WHERE teacher_id = $1 AND event_id = $2 AND date = $3',
          [t.id, eventId, eventDate]
        );
        const existingTimes = new Set((existingSlots || []).map((s) => s.time));

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
            updated_at: new Date().toISOString(),
          });
        }

        if (inserts.length) {
          if (!dryRun) {
            const values = inserts.map((ins, i) => {
              const base = i * 6;
              return `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}, $${base+6})`;
            }).join(', ');
            const flatParams = inserts.flatMap(ins => [
              ins.teacher_id, ins.event_id, ins.date, ins.time, ins.booked, ins.updated_at
            ]);
            await client.query(
              `INSERT INTO slots (teacher_id, event_id, date, time, booked, updated_at) VALUES ${values}`,
              flatParams
            );
          }
          created += inserts.length;
        }
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    return res.json({ success: true, eventId, eventDate, created, skipped, dryRun: Boolean(dryRun), replaceExisting: Boolean(replaceExisting) });
  } catch (error) {
    logger.error({ err: error }, 'Error generating slots for event');
    return res.status(500).json({ error: 'Failed to generate slots for event' });
  }
});

export default router;
