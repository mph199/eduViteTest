import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import { mapBookingRowWithTeacher, mapSlotRow } from '../utils/mappers.js';

export async function listSlotsByTeacherId(teacherId) {
  const { data, error } = await supabase
    .from('slots')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('time');
  if (error) throw error;
  return data.map(mapSlotRow);
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

  const { data, error } = await supabase
    .from('slots')
    .update(updateData)
    .eq('id', slotId)
    .eq('booked', false)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      const err = new Error('Slot already booked or not found');
      err.statusCode = 409;
      throw err;
    }
    throw error;
  }

  return { slotRow: data, verificationToken };
}

export async function verifyBookingToken(token) {
  if (!token || typeof token !== 'string') {
    const err = new Error('Ungültiger oder abgelaufener Link');
    err.statusCode = 404;
    throw err;
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { data: slot, error } = await supabase
    .from('slots')
    .select('*')
    .eq('booked', true)
    // Support both new hashed tokens and legacy plaintext tokens
    .or(`verification_token_hash.eq.${tokenHash},verification_token.eq.${token}`)
    .single();

  if (error || !slot) {
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
      await supabase
        .from('slots')
        .update({ verification_token: null, verification_token_hash: null, updated_at: new Date().toISOString() })
        .eq('id', slot.id);
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
  await supabase
    .from('slots')
    .update({
      verified_at: now,
      // Invalidate token after use
      verification_token: null,
      verification_token_hash: null,
      updated_at: now,
    })
    .eq('id', slot.id);

  return { slotRow: slot, verifiedAt: now };
}

export async function listAdminBookings() {
  const { data, error } = await supabase
    .from('slots')
    .select(`*, teacher:teachers(name, subject)`)
    .eq('booked', true)
    .order('date')
    .order('time');

  if (error) throw error;
  return data.map(mapBookingRowWithTeacher);
}

export async function cancelBookingAdmin(slotId) {
  const { data: current, error: curErr } = await supabase
    .from('slots')
    .select('*')
    .eq('id', slotId)
    .eq('booked', true)
    .single();

  if (curErr || !current) {
    if (curErr?.code === 'PGRST116') {
      const err = new Error('Slot not found or not booked');
      err.statusCode = 404;
      throw err;
    }
    throw curErr;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('slots')
    .update({
      booked: false,
      status: null,
      visitor_type: null,
      parent_name: null,
      company_name: null,
      student_name: null,
      trainee_name: null,
      representative_name: null,
      class_name: null,
      email: null,
      message: null,
      verification_token: null,
      verification_token_hash: null,
      verification_sent_at: null,
      verified_at: null,
      confirmation_sent_at: null,
      // cancellation_sent_at is written after mail send (best-effort)
      updated_at: now,
    })
    .eq('id', slotId)
    .eq('booked', true)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      const err = new Error('Slot not found or not booked');
      err.statusCode = 404;
      throw err;
    }
    throw error;
  }

  return { cleared: data, previous: current };
}
