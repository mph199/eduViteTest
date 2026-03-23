import { query } from '../config/db.js';
import { formatDateDE } from './timeWindows.js';
import logger from '../config/logger.js';

/**
 * Resolves the best event to use for slot generation.
 * Tries: active published event → latest event → settings fallback → today.
 *
 * @returns {{ eventId: number|null, eventDate: string }}
 */
export async function resolveActiveEvent() {
  let eventId = null;
  let eventDate = null;

  // 1. Active published event
  try {
    const nowIso = new Date().toISOString();
    const { rows } = await query(
      `SELECT id, starts_at FROM events
       WHERE status = 'published'
         AND (booking_opens_at IS NULL OR booking_opens_at <= $1)
         AND (booking_closes_at IS NULL OR booking_closes_at >= $1)
       ORDER BY starts_at DESC LIMIT 1`,
      [nowIso]
    );
    if (rows.length) {
      eventId = rows[0].id;
      eventDate = formatDateDE(rows[0].starts_at);
    }
  } catch (e) {
    logger.warn({ err: e }, 'Resolving active event failed');
  }

  // 2. Latest event fallback
  if (!eventId || !eventDate) {
    try {
      const { rows } = await query('SELECT id, starts_at FROM events ORDER BY starts_at DESC LIMIT 1');
      if (rows.length) {
        eventId = rows[0].id;
        eventDate = formatDateDE(rows[0].starts_at);
      }
    } catch (e) {
      logger.warn({ err: e }, 'Resolving latest event failed');
    }
  }

  // 3. Settings fallback
  if (!eventDate) {
    try {
      const { rows } = await query('SELECT event_date FROM settings LIMIT 1');
      if (rows[0]?.event_date) {
        eventDate = formatDateDE(rows[0].event_date);
      }
    } catch {}
  }

  // 4. Today fallback
  if (!eventDate) {
    eventDate = formatDateDE(new Date().toISOString()) || '01.01.1970';
  }

  return { eventId, eventDate };
}

/**
 * Returns the currently active event row (id, starts_at) or null.
 * No fallbacks – returns null when no active event exists.
 * Used by booking guard checks that must reject requests when no event is open.
 */
export async function findActiveEventId() {
  try {
    const nowIso = new Date().toISOString();
    const { rows } = await query(
      `SELECT id, starts_at FROM events
       WHERE status = 'published'
         AND (booking_opens_at IS NULL OR booking_opens_at <= $1)
         AND (booking_closes_at IS NULL OR booking_closes_at >= $1)
       ORDER BY starts_at DESC LIMIT 1`,
      [nowIso]
    );
    return rows.length ? rows[0] : null;
  } catch (e) {
    logger.warn({ err: e }, 'Finding active event failed');
    return null;
  }
}
