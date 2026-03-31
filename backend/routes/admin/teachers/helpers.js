import { db } from '../../../db/database.js';
import { generateTimeSlotsForTeacher } from '../../../utils/timeWindows.js';
import { upsertWeeklySchedule } from '../../../shared/counselorService.js';
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
    await db.insertInto('slots').values(inserts).execute();
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

// ── Generic counselor upsert factory ────────────────────────────────────

/** Normalize db param: accepts a client (with .query) or a bare query function. */
function asDb(db) {
  return typeof db === 'function' ? { query: db } : db;
}

/**
 * Generic factory for upserting counselor profiles (BL, SSW, etc.)
 *
 * @param {object} config
 * @param {string} config.table - counselors table name (e.g. 'bl_counselors')
 * @param {string} config.scheduleTable - weekly schedule table (e.g. 'bl_weekly_schedule')
 * @param {string} config.moduleKey - module access key (e.g. 'beratungslehrer')
 * @param {string[]} [config.extraCols] - additional columns beyond the base set
 * @param {Function} [config.extraValues] - (data) => array of values for extraCols
 */
function createCounselorUpsert(config) {
  const { table, scheduleTable, moduleKey, extraCols = [], extraValues = () => [] } = config;

  return async function upsertCounselor(rawDb, userId, data, { firstName, lastName, email, salutation }) {
    const db = asDb(rawDb);

    // Deactivation
    if (data === null || data === false) {
      await db.query(`UPDATE ${table} SET active = false WHERE user_id = $1`, [userId]);
      await db.query('DELETE FROM user_module_access WHERE user_id = $1 AND module_key = $2', [userId, moduleKey]);
      await db.query('UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = $1', [userId]);
      return;
    }

    // Base fields
    const baseFields = [
      firstName, lastName, email, salutation,
      (data.room || '').trim() || null,
      (data.phone || '').trim() || null,
      data.specializations || null,
      data.available_from || '08:00',
      data.available_until || '14:00',
      data.slot_duration_minutes || 30,
    ];
    const extras = extraValues(data);
    const allFields = [...baseFields, ...extras, userId];

    const { rows: existing } = await db.query(`SELECT id FROM ${table} WHERE user_id = $1`, [userId]);

    let counselorId;
    if (existing.length) {
      counselorId = existing[0].id;
      // Build UPDATE SET clause dynamically
      const baseSets = [
        'room = $1', 'phone = $2', 'specializations = $3',
        'available_from = $4', 'available_until = $5',
        'slot_duration_minutes = $6',
      ];
      const extraSets = extraCols.map((col, i) => `${col} = $${7 + i}`);
      const identitySets = extraCols.length > 0
        ? [`first_name = $${7 + extraCols.length}`, `last_name = $${8 + extraCols.length}`, `email = $${9 + extraCols.length}`, `salutation = $${10 + extraCols.length}`]
        : ['first_name = $7', 'last_name = $8', 'email = $9', 'salutation = $10'];
      const whereIdx = 7 + extraCols.length + 4;
      const setClauses = [...baseSets, ...extraSets, 'active = true', ...identitySets].join(', ');

      await db.query(
        `UPDATE ${table} SET ${setClauses} WHERE user_id = $${whereIdx}`,
        [
          allFields[4], allFields[5], allFields[6], // room, phone, specs
          allFields[7], allFields[8], allFields[9],  // avail_from, avail_until, slot_dur
          ...extras,
          allFields[0], allFields[1], allFields[2], allFields[3], // identity
          userId,
        ]
      );
    } else {
      const baseCols = 'first_name, last_name, email, salutation, room, phone, specializations, available_from, available_until, slot_duration_minutes';
      const extraColStr = extraCols.length > 0 ? ', ' + extraCols.join(', ') : '';
      const placeholders = allFields.map((_, i) => `$${i + 1}`).join(', ');

      const { rows } = await db.query(
        `INSERT INTO ${table} (${baseCols}${extraColStr}, user_id) VALUES (${placeholders}) RETURNING id`,
        allFields
      );
      counselorId = rows[0]?.id;
    }

    if (counselorId && Array.isArray(data.schedule)) {
      const queryFn = typeof rawDb === 'function' ? rawDb : rawDb.query.bind(rawDb);
      await upsertWeeklySchedule(counselorId, data.schedule, scheduleTable, { queryFn });
    }

    await db.query(
      'INSERT INTO user_module_access (user_id, module_key) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, moduleKey]
    );
    await db.query('UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = $1', [userId]);
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
