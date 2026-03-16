/**
 * Shared Counselor Appointment Service Factory
 *
 * Creates a service with standard CRUD operations for counselor modules.
 * Each module provides its own table prefix and config.
 *
 * @param {object} config
 * @param {string} config.tablePrefix          – e.g. 'ssw' or 'bl'
 * @param {string} config.counselorLabel       – e.g. 'Berater/in' or 'Beratungslehrer'
 * @param {string} config.topicTable           – e.g. 'ssw_categories' or 'bl_topics'
 * @param {string} config.topicForeignKey      – e.g. 'category_id' or 'topic_id'
 * @param {string[]} [config.topicSelectCols]  – columns for public topic listing
 */

import { query } from '../config/db.js';

/** Validates that a string is a safe SQL identifier (lowercase letters, digits, underscores). */
const SAFE_IDENTIFIER = /^[a-z][a-z0-9_]*$/;
function assertSafeIdentifier(value, label) {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new Error(`Invalid SQL identifier for ${label}: "${value}"`);
  }
}

export function createCounselorService(config) {
  const {
    tablePrefix,
    counselorLabel,
    topicTable,
    topicForeignKey,
    topicSelectCols = ['id', 'name', 'description'],
  } = config;

  // Validate all identifiers used in SQL interpolation
  assertSafeIdentifier(tablePrefix, 'tablePrefix');
  assertSafeIdentifier(topicTable, 'topicTable');
  assertSafeIdentifier(topicForeignKey, 'topicForeignKey');
  for (const col of topicSelectCols) {
    assertSafeIdentifier(col, 'topicSelectCols');
  }

  const counselorsTable = `${tablePrefix}_counselors`;
  const appointmentsTable = `${tablePrefix}_appointments`;

  return {
    async listCounselors() {
      const { rows } = await query(
        `SELECT id, first_name, last_name, name, salutation, room, specializations,
                available_from, available_until, slot_duration_minutes
         FROM ${counselorsTable} WHERE active = TRUE ORDER BY last_name, first_name`
      );
      return rows;
    },

    async getCounselorById(id) {
      const { rows } = await query(`SELECT * FROM ${counselorsTable} WHERE id = $1`, [id]);
      if (!rows.length) {
        const err = new Error(`${counselorLabel} nicht gefunden`);
        err.statusCode = 404;
        throw err;
      }
      return rows[0];
    },

    async listTopics() {
      const cols = topicSelectCols.join(', ');
      const { rows } = await query(
        `SELECT ${cols} FROM ${topicTable} WHERE active = TRUE ORDER BY sort_order, id`
      );
      return rows;
    },

    async getAvailableAppointments(counselorId, date) {
      const { rows } = await query(
        `SELECT id, date, time, duration_minutes
         FROM ${appointmentsTable}
         WHERE counselor_id = $1 AND date = $2 AND status = 'available'
         ORDER BY time`,
        [counselorId, date]
      );
      return rows;
    },

    async bookAppointment(appointmentId, bookingData) {
      const { student_name, student_class, email, phone, concern, is_urgent } = bookingData;
      const topicValue = bookingData[topicForeignKey] || null;

      const { rows } = await query(
        `UPDATE ${appointmentsTable}
         SET status = 'requested',
             student_name = $1, student_class = $2, email = $3, phone = $4,
             concern = $5, ${topicForeignKey} = $6, is_urgent = $7,
             booked_at = NOW(), updated_at = NOW()
         WHERE id = $8 AND status = 'available'
         RETURNING *`,
        [student_name, student_class || null, email || null, phone || null,
         concern || null, topicValue, is_urgent || false, appointmentId]
      );

      if (!rows.length) {
        const err = new Error('Termin nicht mehr verfuegbar');
        err.statusCode = 409;
        throw err;
      }
      return rows[0];
    },

    generateTimeSlots(availFrom, availUntil, durationMinutes) {
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
    },
  };
}
