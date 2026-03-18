import { query } from '../../../config/db.js';
import { generateTimeSlotsForTeacher } from '../../../utils/timeWindows.js';
import logger from '../../../config/logger.js';

// ── Helper: insert slots for a teacher ──────────────────────────────────

export async function insertTeacherSlots(teacherId, availFrom, availUntil, targetEventId, eventDate) {
  const timeSlots = generateTimeSlotsForTeacher(availFrom, availUntil);
  if (!timeSlots.length || !eventDate) return timeSlots.length;

  const now = new Date().toISOString();
  const slotCols = ['teacher_id', 'event_id', 'time', 'date', 'booked', 'updated_at'];
  const placeholders = [];
  const vals = [];
  let pIdx = 1;
  for (const time of timeSlots) {
    placeholders.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5})`);
    vals.push(teacherId, targetEventId, time, eventDate, false, now);
    pIdx += 6;
  }
  try {
    await query(`INSERT INTO slots (${slotCols.join(', ')}) VALUES ${placeholders.join(', ')}`, vals);
  } catch (slotsError) {
    logger.error({ err: slotsError }, 'Error creating slots');
  }
  return timeSlots.length;
}

// ── Helper: upsert BL counselor profile ─────────────────────────────────

/** Normalize db param: accepts a client (with .query) or a bare query function. */
function asDb(db) {
  return typeof db === 'function' ? { query: db } : db;
}

async function upsertSchedule(rawDb, counselorId, schedule) {
  if (!Array.isArray(schedule)) return;
  const db = asDb(rawDb);
  for (const entry of schedule) {
    const wd = parseInt(entry.weekday, 10);
    if (isNaN(wd) || wd < 0 || wd > 6) continue;
    await db.query(
      `INSERT INTO bl_weekly_schedule (counselor_id, weekday, start_time, end_time, active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (counselor_id, weekday)
       DO UPDATE SET start_time = $3, end_time = $4, active = $5`,
      [counselorId, wd, entry.start_time || '08:00', entry.end_time || '14:00', entry.active !== false]
    );
  }
}

/**
 * Create or update a BL counselor profile linked to a user.
 * @param {object} db - query function or client (must have .query())
 * @param {number} userId - the users.id
 * @param {object} blData - BL form data (room, phone, specializations, schedule, etc.)
 * @param {{ firstName: string, lastName: string, email: string, salutation: string, teacherRoom?: string }} teacher - teacher identity fields
 */
export async function upsertBlCounselor(rawDb, userId, blData, { firstName, lastName, email, salutation, teacherRoom }) {
  const db = asDb(rawDb);
  if (blData === null || blData === false) {
    await db.query('UPDATE bl_counselors SET active = false WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM user_module_access WHERE user_id = $1 AND module_key = $2', [userId, 'beratungslehrer']);
    return;
  }

  const blFields = [
    firstName, lastName, email, salutation,
    (blData.room || teacherRoom || '').trim() || null,
    (blData.phone || '').trim() || null,
    blData.specializations || null,
    blData.available_from || '08:00',
    blData.available_until || '14:00',
    blData.slot_duration_minutes || 30,
    userId,
  ];

  const { rows: existingBl } = await db.query('SELECT id FROM bl_counselors WHERE user_id = $1', [userId]);

  let counselorId;
  if (existingBl.length) {
    counselorId = existingBl[0].id;
    await db.query(
      `UPDATE bl_counselors SET
         room = $1, phone = $2, specializations = $3,
         available_from = $4, available_until = $5,
         slot_duration_minutes = $6, active = true,
         first_name = $7, last_name = $8, email = $9, salutation = $10
       WHERE user_id = $11`,
      [
        blFields[4], blFields[5], blFields[6],
        blFields[7], blFields[8], blFields[9],
        blFields[0], blFields[1], blFields[2], blFields[3],
        userId,
      ]
    );
  } else {
    const { rows: blRows } = await db.query(
      `INSERT INTO bl_counselors (first_name, last_name, email, salutation, room, phone,
       specializations, available_from, available_until, slot_duration_minutes, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      blFields
    );
    counselorId = blRows[0]?.id;
  }

  if (counselorId) {
    await upsertSchedule(db, counselorId, blData.schedule);
  }

  await db.query(
    'INSERT INTO user_module_access (user_id, module_key) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, 'beratungslehrer']
  );
}
