import crypto from 'crypto';
import { query } from '../config/db.js';
import { mapBookingRowWithTeacher, mapSlotRow } from '../utils/mappers.js';

export async function listSlotsByTeacherId(teacherId) {
  const { rows } = await query(
    'SELECT * FROM slots WHERE teacher_id = $1 ORDER BY time',
    [teacherId]
  );
  return rows.map(mapSlotRow);
}

export async function reserveBooking({
  slotId,
  visitorType,
  parentName,
  companyName,
  studentName,
  traineeName,
  representativeName,
  className,
  email,
  message,
}) {
  if (!slotId || !visitorType || !className || !email) {
    const err = new Error('slotId, visitorType, className, email required');
    err.statusCode = 400;
    throw err;
  }

  if (visitorType === 'parent') {
    if (!parentName || !studentName) {
      const err = new Error('parentName and studentName required for parent type');
      err.statusCode = 400;
      throw err;
    }
  } else if (visitorType === 'company') {
    if (!companyName || !traineeName || !representativeName) {
      const err = new Error('companyName, traineeName and representativeName required for company type');
      err.statusCode = 400;
      throw err;
    }
  } else {
    const err = new Error('visitorType must be parent or company');
    err.statusCode = 400;
    throw err;
  }

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationTokenHash = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  const nowIso = new Date().toISOString();

  const updateData = {
    booked: true,
    status: 'reserved',
    visitor_type: visitorType,
    class_name: className,
    email: email,
    message: message || null,
    // Best practice: store only a hash of the verification token.
    // Keep legacy verification_token for backwards compatibility (older bookings).
    verification_token: null,
    verification_token_hash: verificationTokenHash,
    verification_sent_at: nowIso,
    verified_at: null,
    confirmation_sent_at: null,
    cancellation_sent_at: null,
    updated_at: nowIso,
  };

  if (visitorType === 'parent') {
    updateData.parent_name = parentName;
    updateData.student_name = studentName;
    updateData.company_name = null;
    updateData.trainee_name = null;
    updateData.representative_name = null;
  } else {
    updateData.company_name = companyName;
    updateData.trainee_name = traineeName;
    updateData.representative_name = representativeName;
    updateData.parent_name = null;
    updateData.student_name = null;
  }

  // Build dynamic SET clause from updateData
  const keys = Object.keys(updateData);
  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
  const values = keys.map((k) => updateData[k]);
  const offset = values.length;

  const { rows } = await query(
    `UPDATE slots SET ${setClauses.join(', ')}
     WHERE id = $${offset + 1} AND booked = false
     RETURNING *`,
    [...values, slotId]
  );

  if (rows.length === 0) {
    const err = new Error('Slot already booked or not found');
    err.statusCode = 409;
    throw err;
  }

  return { slotRow: rows[0], verificationToken };
}

export async function verifyBookingToken(token) {
  if (!token || typeof token !== 'string') {
    const err = new Error('Ungültiger oder abgelaufener Link');
    err.statusCode = 404;
    throw err;
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows } = await query(
    `SELECT * FROM slots
     WHERE booked = true
       AND (verification_token_hash = $1 OR verification_token = $2)
     LIMIT 1`,
    [tokenHash, token]
  );
  const slot = rows[0] || null;

  if (!slot) {
    const err = new Error('Ungültiger oder abgelaufener Link');
    err.statusCode = 404;
    throw err;
  }

  const ttlHoursRaw = process.env.VERIFICATION_TOKEN_TTL_HOURS;
  const ttlHours = Number.parseInt(ttlHoursRaw || '72', 10);
  const ttlMs = (Number.isFinite(ttlHours) ? ttlHours : 72) * 60 * 60 * 1000;

  // Idempotent verify: if already verified, return existing timestamp.
  if (slot.verified_at) {
    // Also invalidate any remaining token fields.
    try {
      await query(
        'UPDATE slots SET verification_token = NULL, verification_token_hash = NULL, updated_at = $1 WHERE id = $2',
        [new Date().toISOString(), slot.id]
      );
    } catch {}
    return { slotRow: slot, verifiedAt: slot.verified_at };
  }

  if (slot.verification_sent_at) {
    const sentAt = new Date(slot.verification_sent_at);
    const sentOk = Number.isNaN(sentAt.getTime()) ? false : true;
    if (sentOk) {
      const ageMs = Date.now() - sentAt.getTime();
      if (ageMs > ttlMs) {
        const err = new Error('Link abgelaufen. Bitte buchen Sie den Termin erneut.');
        err.statusCode = 410;
        throw err;
      }
    }
  }

  const now = new Date().toISOString();
  await query(
    `UPDATE slots
     SET verified_at = $1, verification_token = NULL, verification_token_hash = NULL, updated_at = $1
     WHERE id = $2`,
    [now, slot.id]
  );

  return { slotRow: slot, verifiedAt: now };
}

export async function listAdminBookings() {
  const { rows } = await query(
    `SELECT s.*, t.name AS teacher_name, t.subject AS teacher_subject
     FROM slots s
     LEFT JOIN teachers t ON s.teacher_id = t.id
     WHERE s.booked = true
     ORDER BY s.date, s.time`
  );
  // Re-shape rows so mapBookingRowWithTeacher can read slot.teacher.subject
  return rows.map((r) => {
    const { teacher_name, teacher_subject, ...slot } = r;
    slot.teacher = { name: teacher_name, subject: teacher_subject };
    return mapBookingRowWithTeacher(slot);
  });
}

export async function cancelBookingAdmin(slotId) {
  const { rows: curRows } = await query(
    'SELECT * FROM slots WHERE id = $1 AND booked = true',
    [slotId]
  );
  const current = curRows[0] || null;

  if (!current) {
    const err = new Error('Slot not found or not booked');
    err.statusCode = 404;
    throw err;
  }

  const now = new Date().toISOString();
  const { rows } = await query(
    `UPDATE slots SET
       booked = false, status = NULL, visitor_type = NULL,
       parent_name = NULL, company_name = NULL, student_name = NULL,
       trainee_name = NULL, representative_name = NULL, class_name = NULL,
       email = NULL, message = NULL,
       verification_token = NULL, verification_token_hash = NULL,
       verification_sent_at = NULL, verified_at = NULL,
       confirmation_sent_at = NULL,
       updated_at = $1
     WHERE id = $2 AND booked = true
     RETURNING *`,
    [now, slotId]
  );

  if (rows.length === 0) {
    const err = new Error('Slot not found or not booked');
    err.statusCode = 404;
    throw err;
  }

  return { cleared: rows[0], previous: current };
}
