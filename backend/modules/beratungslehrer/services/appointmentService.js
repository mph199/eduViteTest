import crypto from 'node:crypto';
import { query } from '../../../config/db.js';

/**
 * List active counselors with their info (public — no email/phone exposed).
 */
export async function listCounselors() {
  const { rows } = await query(
    `SELECT id, first_name, last_name, name, salutation, room, specializations,
            available_from, available_until, slot_duration_minutes
     FROM bl_counselors WHERE active = TRUE ORDER BY last_name, first_name`
  );
  return rows;
}

/**
 * Get a single counselor by ID.
 */
export async function getCounselorById(id) {
  const { rows } = await query('SELECT * FROM bl_counselors WHERE id = $1', [id]);
  if (!rows.length) {
    const err = new Error('Beratungslehrer nicht gefunden');
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
}

/**
 * List active topics.
 */
export async function listTopics() {
  const { rows } = await query(
    'SELECT id, name, description FROM bl_topics WHERE active = TRUE ORDER BY sort_order, id'
  );
  return rows;
}

/**
 * Get available appointments for a counselor on a given date.
 */
export async function getAvailableAppointments(counselorId, date) {
  const { rows } = await query(
    `SELECT id, date, time, duration_minutes
     FROM bl_appointments
     WHERE counselor_id = $1 AND date = $2 AND status = 'available'
     ORDER BY time`,
    [counselorId, date]
  );
  return rows;
}

/**
 * Book an appointment (supports anonymous booking).
 */
export async function bookAppointment(appointmentId, bookingData) {
  const { student_name, student_class, email, phone, concern, topic_id, is_urgent, is_anonymous } = bookingData;

  const { rows } = await query(
    `UPDATE bl_appointments
     SET status = 'requested',
         student_name = $1, student_class = $2, email = $3, phone = $4,
         concern = $5, topic_id = $6, is_urgent = $7, is_anonymous = $8,
         booked_at = NOW(), updated_at = NOW()
     WHERE id = $9 AND status = 'available'
     RETURNING *`,
    [student_name || null, student_class || null, email || null, phone || null,
     concern || null, topic_id || null, is_urgent || false, is_anonymous || false, appointmentId]
  );

  if (!rows.length) {
    const err = new Error('Termin nicht mehr verfuegbar');
    err.statusCode = 409;
    throw err;
  }
  return rows[0];
}

/**
 * Generate time slots for a counselor on a given date.
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
 * Create an anonymous request with a secure access token.
 */
export async function createRequest(requestData) {
  const { counselor_id, topic_id, message, contact_method, contact_info, is_urgent } = requestData;
  const accessToken = crypto.randomBytes(32).toString('hex');

  const { rows } = await query(
    `INSERT INTO bl_requests (counselor_id, topic_id, message, contact_method, contact_info, is_urgent, access_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [counselor_id || null, topic_id || null, message, contact_method || 'none',
     contact_info || null, is_urgent || false, accessToken]
  );
  return rows[0];
}

/**
 * Get a request by its access token (public — no personal data exposed).
 */
export async function getRequestByToken(token) {
  const { rows } = await query(
    `SELECT r.status, r.response, r.responded_at, t.name AS topic_name, r.created_at
     FROM bl_requests r
     LEFT JOIN bl_topics t ON t.id = r.topic_id
     WHERE r.access_token = $1`,
    [token]
  );
  if (!rows.length) {
    const err = new Error('Anfrage nicht gefunden');
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
}
