import { db as kyselyDb } from '../../../db/database.js';
import { sql } from 'kysely';
import { generateTimeSlotsForTeacher } from '../../../utils/timeWindows.js';
import { upsertWeeklySchedule } from '../../../shared/counselorService.js';
import { assertSafeIdentifier } from '../../../shared/sqlGuards.js';
import logger from '../../../config/logger.js';

// ── Helper: insert slots for a teacher ──────────────────────────────────

export async function insertTeacherSlots(teacherId, availFrom, availUntil, targetEventId, eventDate) {
  const timeSlots = generateTimeSlotsForTeacher(availFrom, availUntil);
  if (!timeSlots.length || !eventDate) return timeSlots.length;

  const inserts = timeSlots.map(time => ({
    teacher_id: teacherId,
    event_id: targetEventId,
    time,
    date: eventDate,
    booked: false,
    updated_at: new Date(),
  }));

  try {
    await kyselyDb.insertInto('slots').values(inserts).execute();
  } catch (slotsError) {
    logger.error({ err: slotsError }, 'Error creating slots');
  }
  return timeSlots.length;
}

// ── Helper: parse teacher name from request body ────────────────────────

export function parseTeacherName(body) {
  let firstName = (body.first_name || '').trim();
  let lastName = (body.last_name || '').trim();
  if (!lastName && body.name) {
    const parts = String(body.name).trim().split(/\s+/);
    lastName = parts.pop() || '';
    firstName = parts.join(' ');
  }
  return { firstName, lastName };
}

// ── Generic counselor upsert factory (Kysely) ──────────────────────────

/**
 * @param {object} config
 * @param {string} config.table - counselors table name
 * @param {string} config.scheduleTable - weekly schedule table
 * @param {string} config.moduleKey - module access key
 * @param {string[]} [config.extraCols] - additional columns
 * @param {Function} [config.extraValues] - (data) => array of values
 */
function createCounselorUpsert(config) {
  const { table, scheduleTable, moduleKey, extraCols = [], extraValues = () => [] } = config;
  assertSafeIdentifier(table, 'counselor table');
  assertSafeIdentifier(scheduleTable, 'schedule table');

  return async function upsertCounselor(_unused, userId, data, { firstName, lastName, email, salutation }) {
    // Deactivation
    if (data === null || data === false) {
      await sql`UPDATE ${sql.table(table)} SET active = false WHERE user_id = ${userId}`.execute(kyselyDb);
      await kyselyDb.deleteFrom('user_module_access')
        .where('user_id', '=', userId)
        .where('module_key', '=', moduleKey)
        .execute();
      await sql`UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ${userId}`.execute(kyselyDb);
      return;
    }

    const room = (data.room || '').trim() || null;
    const phone = (data.phone || '').trim() || null;
    const specializations = data.specializations || null;
    const availFrom = data.available_from || '08:00';
    const availUntil = data.available_until || '14:00';
    const slotDuration = data.slot_duration_minutes || 30;
    const extras = extraValues(data);

    // Check if counselor exists
    const { rows: existing } = await sql`
      SELECT id FROM ${sql.table(table)} WHERE user_id = ${userId}
    `.execute(kyselyDb);

    let counselorId;
    if (existing.length) {
      counselorId = existing[0].id;

      // Build dynamic UPDATE with extras
      const extraSetClauses = extraCols.map((col, i) => {
        assertSafeIdentifier(col, `extraCol ${col}`);
        return sql`${sql.ref(col)} = ${extras[i]}`;
      });

      const allSets = sql.join([
        sql`first_name = ${firstName}`,
        sql`last_name = ${lastName}`,
        sql`email = ${email}`,
        sql`salutation = ${salutation}`,
        sql`room = ${room}`,
        sql`phone = ${phone}`,
        sql`specializations = ${specializations}`,
        sql`available_from = ${availFrom}`,
        sql`available_until = ${availUntil}`,
        sql`slot_duration_minutes = ${slotDuration}`,
        sql`active = true`,
        ...extraSetClauses,
      ], sql`, `);

      await sql`
        UPDATE ${sql.table(table)} SET ${allSets} WHERE user_id = ${userId}
      `.execute(kyselyDb);
    } else {
      // INSERT new counselor
      const baseCols = sql`first_name, last_name, email, salutation, room, phone, specializations, available_from, available_until, slot_duration_minutes`;
      const baseVals = sql`${firstName}, ${lastName}, ${email}, ${salutation}, ${room}, ${phone}, ${specializations}, ${availFrom}, ${availUntil}, ${slotDuration}`;

      let colsExpr = baseCols;
      let valsExpr = baseVals;
      if (extraCols.length > 0) {
        const extraColsExpr = sql.join(extraCols.map(c => sql.ref(c)), sql`, `);
        const extraValsExpr = sql.join(extras.map(v => sql`${v}`), sql`, `);
        colsExpr = sql`${baseCols}, ${extraColsExpr}`;
        valsExpr = sql`${baseVals}, ${extraValsExpr}`;
      }

      const { rows } = await sql`
        INSERT INTO ${sql.table(table)} (${colsExpr}, user_id)
        VALUES (${valsExpr}, ${userId})
        RETURNING id
      `.execute(kyselyDb);
      counselorId = rows[0]?.id;
    }

    if (counselorId && Array.isArray(data.schedule)) {
      await upsertWeeklySchedule(counselorId, data.schedule, scheduleTable);
    }

    await kyselyDb.insertInto('user_module_access')
      .values({ user_id: userId, module_key: moduleKey })
      .onConflict((oc) => oc.doNothing())
      .execute();

    await sql`UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ${userId}`.execute(kyselyDb);
  };
}

// ── Concrete upsert functions ───────────────────────────────────────────

export const upsertBlCounselor = createCounselorUpsert({
  table: 'bl_counselors',
  scheduleTable: 'bl_weekly_schedule',
  moduleKey: 'beratungslehrer',
});

export const upsertSswCounselor = createCounselorUpsert({
  table: 'ssw_counselors',
  scheduleTable: 'ssw_weekly_schedule',
  moduleKey: 'schulsozialarbeit',
  extraCols: ['requires_confirmation'],
  extraValues: (data) => [data.requires_confirmation ?? true],
});
