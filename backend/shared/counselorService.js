/**
 * Shared Counselor Appointment Service Factory
 *
 * Creates a service with standard CRUD operations for counselor modules.
 * Each module provides its own table prefix and config.
 *
 * @param {object} config
 * @param {string} config.tablePrefix          – e.g. 'ssw' or 'bl'
 * @param {string} config.counselorLabel       – e.g. 'Berater/in' or 'Beratungslehrer'
 */

import { db } from '../db/database.js';
import { sql } from 'kysely';
import { assertSafeIdentifier } from './sqlGuards.js';

/**
 * Generate appointment slots for a counselor over a date range.
 *
 * @param {number} counselorId
 * @param {object} opts
 * @param {string} opts.date_from  – YYYY-MM-DD
 * @param {string} opts.date_until – YYYY-MM-DD (defaults to date_from)
 * @param {boolean} [opts.exclude_weekends=true]
 * @param {object} tables – { counselorsTable, appointmentsTable, scheduleTable }
 * @returns {Promise<{ created: number, skipped: number }>}
 */
export async function generateSlotsForDateRange(counselorId, opts, tables) {
  const { date_from, date_until, exclude_weekends = true } = opts;
  const { counselorsTable, appointmentsTable, scheduleTable, counselorLabel } = tables;

  // Validate identifiers
  assertSafeIdentifier(counselorsTable, 'counselorsTable');
  assertSafeIdentifier(appointmentsTable, 'appointmentsTable');
  assertSafeIdentifier(scheduleTable, 'scheduleTable');

  const endDate = date_until && /^\d{4}-\d{2}-\d{2}$/.test(date_until) ? date_until : date_from;

  if (new Date(endDate) < new Date(date_from)) {
    const err = new Error('date_until darf nicht vor date_from liegen');
    err.statusCode = 400;
    throw err;
  }

  // Get counselor details
  const { rows: cRows } = await sql`
    SELECT id, first_name, last_name, name, email, phone, room, specializations,
           available_from, available_until, slot_duration_minutes, user_id, active, created_at
    FROM ${sql.table(counselorsTable)}
    WHERE id = ${counselorId}
  `.execute(db);

  const counselor = cRows[0];
  if (!counselor) {
    const err = new Error(`${counselorLabel || 'Berater/in'} nicht gefunden`);
    err.statusCode = 404;
    throw err;
  }

  // Load weekly schedule
  const { rows: scheduleRows } = await sql`
    SELECT id, counselor_id, weekday, start_time, end_time, active
    FROM ${sql.table(scheduleTable)}
    WHERE counselor_id = ${counselorId} AND active = TRUE
    ORDER BY weekday
  `.execute(db);

  // Build map: JS weekday (0=Sun..6=Sat) -> { start, end }
  // DB weekday: 0=Mon..4=Fri,5=Sat,6=Sun -> JS: Mon=1..Fri=5,Sat=6,Sun=0
  const scheduleByJsDay = new Map();
  for (const s of scheduleRows) {
    const jsDay = s.weekday === 6 ? 0 : s.weekday + 1;
    scheduleByJsDay.set(jsDay, {
      start: s.start_time?.toString()?.slice(0, 5),
      end: s.end_time?.toString()?.slice(0, 5),
    });
  }

  const hasSchedule = scheduleByJsDay.size > 0;
  const duration = counselor.slot_duration_minutes || 30;
  const defaultFrom = counselor.available_from?.toString()?.slice(0, 5) || '08:00';
  const defaultUntil = counselor.available_until?.toString()?.slice(0, 5) || '14:00';

  let totalCreated = 0;
  let totalSkipped = 0;
  const start = new Date(date_from);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();

    let fromStr, untilStr;
    if (hasSchedule) {
      const entry = scheduleByJsDay.get(dayOfWeek);
      if (!entry) continue;
      fromStr = entry.start;
      untilStr = entry.end;
    } else {
      if (exclude_weekends && (dayOfWeek === 0 || dayOfWeek === 6)) continue;
      fromStr = defaultFrom;
      untilStr = defaultUntil;
    }

    const timeSlots = generateTimeSlots(fromStr, untilStr, duration);
    const dateStr = d.toISOString().slice(0, 10);

    const { rows: existing } = await sql`
      SELECT time FROM ${sql.table(appointmentsTable)}
      WHERE counselor_id = ${counselorId} AND date = ${dateStr}
    `.execute(db);

    const existingTimes = new Set(existing.map(r => r.time?.toString()?.slice(0, 5)));

    const newSlots = timeSlots.filter(t => !existingTimes.has(t));
    totalSkipped += existingTimes.size;
    if (!newSlots.length) continue;

    // Build VALUES clause for bulk insert
    const valuesExpr = sql.join(
      newSlots.map(time =>
        sql`(${counselorId}, ${dateStr}, ${time}, ${duration}, 'available')`
      ),
      sql`, `
    );

    await sql`
      INSERT INTO ${sql.table(appointmentsTable)}
        (counselor_id, date, time, duration_minutes, status)
      VALUES ${valuesExpr}
    `.execute(db);

    totalCreated += newSlots.length;
  }

  return { created: totalCreated, skipped: totalSkipped };
}

/**
 * Pure function: generate time slot strings from a start/end time and duration.
 */
export function generateTimeSlots(availFrom, availUntil, durationMinutes) {
  const slots = [];
  const [fromH, fromM] = availFrom.split(':').map(Number);
  const [untilH, untilM] = availUntil.split(':').map(Number);
  let current = fromH * 60 + fromM;
  const end = untilH * 60 + untilM;

  while (current + durationMinutes <= end) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    current += durationMinutes;
  }
  return slots;
}

/**
 * Upsert weekly schedule entries for a counselor.
 *
 * @param {number} counselorId
 * @param {Array} schedule – [{ weekday, start_time, end_time, active }]
 * @param {string} scheduleTable – e.g. 'bl_weekly_schedule'
 * @param {object} [opts]
 * @param {object} [opts.trx] – Kysely transaction instance, defaults to db
 * @param {number} [opts.minDay=0] – minimum valid weekday
 * @param {number} [opts.maxDay=6] – maximum valid weekday
 * @returns {Promise<Array>} – updated schedule rows
 */
export async function upsertWeeklySchedule(counselorId, schedule, scheduleTable, opts = {}) {
  assertSafeIdentifier(scheduleTable, 'scheduleTable');
  const { minDay = 0, maxDay = 6, trx = db } = opts;

  if (!Array.isArray(schedule)) {
    const err = new Error('schedule muss ein Array sein');
    err.statusCode = 400;
    throw err;
  }

  for (const entry of schedule) {
    const wd = parseInt(entry.weekday, 10);
    if (isNaN(wd) || wd < minDay || wd > maxDay) {
      const err = new Error(`Ungültiger Wochentag: ${entry.weekday}`);
      err.statusCode = 400;
      throw err;
    }
    if (entry.active && (!entry.start_time || !entry.end_time)) {
      const err = new Error(`Start- und Endzeit erforderlich für Tag ${wd}`);
      err.statusCode = 400;
      throw err;
    }
  }

  for (const entry of schedule) {
    const wd = parseInt(entry.weekday, 10);
    const startTime = entry.start_time || '08:00';
    const endTime = entry.end_time || '14:00';
    const isActive = entry.active !== false;

    await sql`
      INSERT INTO ${sql.table(scheduleTable)} (counselor_id, weekday, start_time, end_time, active)
      VALUES (${counselorId}, ${wd}, ${startTime}, ${endTime}, ${isActive})
      ON CONFLICT (counselor_id, weekday)
      DO UPDATE SET start_time = ${startTime}, end_time = ${endTime}, active = ${isActive}
    `.execute(trx);
  }

  const { rows } = await sql`
    SELECT id, counselor_id, weekday, start_time, end_time, active
    FROM ${sql.table(scheduleTable)}
    WHERE counselor_id = ${counselorId}
    ORDER BY weekday
  `.execute(trx);

  return rows;
}

export function createCounselorService(config) {
  const {
    tablePrefix,
    counselorLabel,
  } = config;

  // Validate all identifiers used in SQL interpolation
  assertSafeIdentifier(tablePrefix, 'tablePrefix');

  const counselorsTable = `${tablePrefix}_counselors`;
  const appointmentsTable = `${tablePrefix}_appointments`;

  return {
    async listCounselors() {
      const { rows } = await sql`
        SELECT id, first_name, last_name, name, salutation, room, specializations,
               available_from, available_until, slot_duration_minutes
        FROM ${sql.table(counselorsTable)}
        WHERE active = TRUE
        ORDER BY last_name, first_name
      `.execute(db);
      return rows;
    },

    async getCounselorById(id) {
      const { rows } = await sql`
        SELECT id, first_name, last_name, name, email, phone, room, specializations,
               available_from, available_until, slot_duration_minutes, user_id, active, created_at
        FROM ${sql.table(counselorsTable)}
        WHERE id = ${id}
      `.execute(db);

      if (!rows.length) {
        const err = new Error(`${counselorLabel} nicht gefunden`);
        err.statusCode = 404;
        throw err;
      }
      return rows[0];
    },

    async getAvailableAppointments(counselorId, date) {
      const { rows } = await sql`
        SELECT id, date, time, duration_minutes
        FROM ${sql.table(appointmentsTable)}
        WHERE counselor_id = ${counselorId} AND date = ${date} AND status = 'available'
        ORDER BY time
      `.execute(db);
      return rows;
    },

    async bookAppointment(appointmentId, bookingData, requiresConfirmation = true) {
      const { first_name, last_name, student_class, email, phone } = bookingData;

      const targetStatus = requiresConfirmation ? 'requested' : 'confirmed';
      const confirmedClause = requiresConfirmation
        ? sql``
        : sql`, confirmed_at = NOW()`;

      const { rows } = await sql`
        UPDATE ${sql.table(appointmentsTable)}
        SET status = ${targetStatus},
            first_name = ${first_name}, last_name = ${last_name},
            student_class = ${student_class || null}, email = ${email || null}, phone = ${phone || null},
            booked_at = NOW(), updated_at = NOW()${confirmedClause}
        WHERE id = ${appointmentId} AND status = 'available'
        RETURNING *
      `.execute(db);

      if (!rows.length) {
        const err = new Error('Termin nicht mehr verfügbar');
        err.statusCode = 409;
        throw err;
      }
      return rows[0];
    },

    generateTimeSlots,
  };
}
