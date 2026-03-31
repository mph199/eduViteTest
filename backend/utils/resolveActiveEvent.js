import { db } from '../db/database.js';
import { formatDateDE } from './timeWindows.js';
import logger from '../config/logger.js';

/**
 * Resolves the best event to use for slot generation.
 * Tries: active published event → latest event → settings fallback → today.
 */
export async function resolveActiveEvent() {
  let eventId = null;
  let eventDate = null;

  // 1. Active published event
  try {
    const now = new Date();
    const row = await db.selectFrom('events')
      .select(['id', 'starts_at'])
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
      .executeTakeFirst();

    if (row) {
      eventId = row.id;
      eventDate = formatDateDE(row.starts_at);
    }
  } catch (e) {
    logger.warn({ err: e }, 'Resolving active event failed');
  }

  // 2. Latest event fallback
  if (!eventId || !eventDate) {
    try {
      const row = await db.selectFrom('events')
        .select(['id', 'starts_at'])
        .orderBy('starts_at', 'desc')
        .limit(1)
        .executeTakeFirst();
      if (row) {
        eventId = row.id;
        eventDate = formatDateDE(row.starts_at);
      }
    } catch (e) {
      logger.warn({ err: e }, 'Resolving latest event failed');
    }
  }

  // 3. Settings fallback
  if (!eventDate) {
    try {
      const row = await db.selectFrom('settings')
        .select('event_date')
        .limit(1)
        .executeTakeFirst();
      if (row?.event_date) {
        eventDate = formatDateDE(row.event_date);
      }
    } catch (err) {
      logger.warn({ err }, 'resolveActiveEvent: settings fallback query failed');
    }
  }

  // 4. Today fallback
  if (!eventDate) {
    eventDate = formatDateDE(new Date().toISOString()) || '01.01.1970';
  }

  return { eventId, eventDate };
}

/**
 * Returns the currently active event row (id, starts_at) or null.
 * No fallbacks – used by booking guard checks.
 */
export async function findActiveEventId() {
  try {
    const now = new Date();
    const row = await db.selectFrom('events')
      .select(['id', 'starts_at'])
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
      .executeTakeFirst();

    return row || null;
  } catch (e) {
    logger.warn({ err: e }, 'Finding active event failed');
    return null;
  }
}
