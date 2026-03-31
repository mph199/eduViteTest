import crypto from 'crypto';
import { sql } from 'kysely';
import { db } from '../../../db/database.js';
import { mapBookingRowWithTeacher } from '../../../utils/mappers.js';
import { getVerificationTtlMs } from '../../../shared/tokenUtils.js';

export async function reserveBooking({
  slotId, visitorType, parentName, companyName, studentName,
  traineeName, representativeName, className, email, message,
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
  const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
  const now = new Date();

  const updateData = {
    booked: true,
    status: 'reserved',
    visitor_type: visitorType,
    class_name: className,
    email,
    message: message || null,
    verification_token_hash: verificationTokenHash,
    verification_sent_at: now,
    verified_at: null,
    confirmation_sent_at: null,
    cancellation_sent_at: null,
    updated_at: now,
    parent_name: visitorType === 'parent' ? parentName : null,
    student_name: visitorType === 'parent' ? studentName : null,
    company_name: visitorType === 'company' ? companyName : null,
    trainee_name: visitorType === 'company' ? traineeName : null,
    representative_name: visitorType === 'company' ? representativeName : null,
  };

  const slotRow = await db.updateTable('slots')
    .set(updateData)
    .where('id', '=', slotId)
    .where('booked', '=', false)
    .returningAll()
    .executeTakeFirst();

  if (!slotRow) {
    const err = new Error('Slot already booked or not found');
    err.statusCode = 409;
    throw err;
  }

  return { slotRow, verificationToken };
}

export async function verifyBookingToken(token) {
  if (!token || typeof token !== 'string') {
    const err = new Error('Ungültiger oder abgelaufener Link');
    err.statusCode = 404;
    throw err;
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const slot = await db.selectFrom('slots')
    .selectAll()
    .where('booked', '=', true)
    .where('verification_token_hash', '=', tokenHash)
    .executeTakeFirst();

  if (!slot) {
    const err = new Error('Ungültiger oder abgelaufener Link');
    err.statusCode = 404;
    throw err;
  }

  const ttlMs = getVerificationTtlMs();

  if (slot.verified_at) {
    try {
      await db.updateTable('slots')
        .set({ verification_token_hash: null, updated_at: new Date() })
        .where('id', '=', slot.id)
        .execute();
    } catch { /* non-critical */ }
    return { slotRow: slot, verifiedAt: slot.verified_at };
  }

  if (slot.verification_sent_at) {
    const sentAt = new Date(slot.verification_sent_at);
    if (!Number.isNaN(sentAt.getTime()) && Date.now() - sentAt.getTime() > ttlMs) {
      const err = new Error('Link abgelaufen. Bitte buchen Sie den Termin erneut.');
      err.statusCode = 410;
      throw err;
    }
  }

  const now = new Date();
  await db.updateTable('slots')
    .set({ verified_at: now, verification_token_hash: null, updated_at: now })
    .where('id', '=', slot.id)
    .execute();

  return { slotRow: slot, verifiedAt: now.toISOString() };
}

export async function listAdminBookings() {
  const result = await sql`
    SELECT s.*, t.name AS teacher_name, t.subject AS teacher_subject
    FROM slots s
    LEFT JOIN teachers t ON s.teacher_id = t.id
    LEFT JOIN booking_requests br ON br.assigned_slot_id = s.id
    WHERE s.booked = true
      AND (br.restricted IS NOT TRUE OR br.id IS NULL)
    ORDER BY s.date, s.time
  `.execute(db);

  return result.rows.map((r) => {
    const { teacher_name, teacher_subject, ...slot } = r;
    slot.teacher = { name: teacher_name, subject: teacher_subject };
    return mapBookingRowWithTeacher(slot);
  });
}

export async function cancelBookingAdmin(slotId) {
  const current = await db.selectFrom('slots')
    .selectAll()
    .where('id', '=', slotId)
    .where('booked', '=', true)
    .executeTakeFirst();

  if (!current) {
    const err = new Error('Slot not found or not booked');
    err.statusCode = 404;
    throw err;
  }

  const cleared = await db.updateTable('slots')
    .set({
      booked: false, status: null, visitor_type: null,
      parent_name: null, company_name: null, student_name: null,
      trainee_name: null, representative_name: null, class_name: null,
      email: null, message: null, verification_token_hash: null,
      verification_sent_at: null, verified_at: null, confirmation_sent_at: null,
      updated_at: new Date(),
    })
    .where('id', '=', slotId)
    .where('booked', '=', true)
    .returningAll()
    .executeTakeFirst();

  if (!cleared) {
    const err = new Error('Slot not found or not booked');
    err.statusCode = 404;
    throw err;
  }

  return { cleared, previous: current };
}
