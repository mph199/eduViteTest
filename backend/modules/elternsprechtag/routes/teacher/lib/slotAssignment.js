import { sql } from 'kysely';
import { db } from '../../../../../db/database.js';
import { isEmailConfigured, sendMail } from '../../../../../config/email.js';
import { buildEmail, getEmailBranding } from '../../../../../emails/template.js';
import { getTeacherById } from '../../../services/teachersService.js';
import { parseTimeWindow, fmtMinutes } from '../../../../../utils/timeWindows.js';
import logger from '../../../../../config/logger.js';

/**
 * Builds the slot update object from a booking request row.
 * Used when assigning a request to a slot (both normal and extra-slot assignment).
 */
export function buildSlotUpdateFromRequest(row, slot, now) {
  return {
    event_id: row.event_id ?? slot.event_id ?? null,
    booked: true,
    status: 'confirmed',
    visitor_type: row.visitor_type,
    class_name: row.class_name,
    email: row.email,
    message: row.message || null,
    parent_name: row.parent_name,
    student_name: row.student_name,
    company_name: row.company_name,
    trainee_name: row.trainee_name,
    representative_name: row.representative_name,
    verified_at: row.verified_at,
    verification_token_hash: null,
    verification_sent_at: null,
    updated_at: now,
  };
}

export function buildAssignableSlotTimesFromRequestedWindow(requestedTime, slotMinutes = null) {
  const parsed = parseTimeWindow(requestedTime);
  if (!parsed) return [];

  const windowSize = parsed.end - parsed.start;
  const dur = slotMinutes && [10, 15, 20, 30].includes(slotMinutes)
    ? slotMinutes
    : (windowSize <= 30 ? windowSize : 15);

  const times = [];
  for (let m = parsed.start; m + dur <= parsed.end; m += dur) {
    times.push(`${fmtMinutes(m)} - ${fmtMinutes(m + dur)}`);
  }

  if (!times.length && windowSize > 0) {
    return [`${fmtMinutes(parsed.start)} - ${fmtMinutes(parsed.end)}`];
  }
  return times;
}

export function isValidSlotTimeRange(value) {
  return /^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/.test(String(value || '').trim());
}

export function pickPreferredSlot(slotRows, orderedTimes, eventId) {
  const rows = slotRows || [];

  for (const t of orderedTimes) {
    if (eventId != null) {
      const exact = rows.find((r) => r.time === t && r.event_id === eventId);
      if (exact) return exact;
      const legacy = rows.find((r) => r.time === t && r.event_id == null);
      if (legacy) return legacy;
      continue;
    }

    const nullScoped = rows.find((r) => r.time === t && r.event_id == null);
    if (nullScoped) return nullScoped;
    const anyScoped = rows.find((r) => r.time === t);
    if (anyScoped) return anyScoped;
  }

  return null;
}

export async function getTeacherTimeRange(teacherId) {
  const rows = await db.selectFrom('teachers')
    .select(['available_from', 'available_until'])
    .where('id', '=', teacherId)
    .execute();
  if (rows.length === 0) throw new Error('Teacher not found');
  return { availableFrom: rows[0]?.available_from || '16:00', availableUntil: rows[0]?.available_until || '19:00' };
}

// ── Email helpers ───────────────────────────────────────────────────────

async function sendRequestConfirmationIfPossible(updatedSlot, requestRow, teacherId, now, teacherMessage = '') {
  if (!updatedSlot?.email || !isEmailConfigured()) return;

  try {
    const teacher = await getTeacherById(teacherId) || {};
    const safeTeacherMessage = String(teacherMessage || '').trim();
    const branding = await getEmailBranding();
    const { subject, text, html } = buildEmail('confirmation', {
      date: updatedSlot.date, time: updatedSlot.time,
      teacherName: teacher.name,
      teacherMessage: safeTeacherMessage,
    }, branding);
    await sendMail({ to: updatedSlot.email, subject, text, html });
    await db.updateTable('slots')
      .set({ confirmation_sent_at: now })
      .where('id', '=', updatedSlot.id)
      .execute();
    await db.updateTable('booking_requests')
      .set({ confirmation_sent_at: now, updated_at: now })
      .where('id', '=', requestRow.id)
      .execute();
  } catch (e) {
    logger.warn({ err: e }, 'Sending request confirmation email failed');
  }
}

export async function sendMultiSlotConfirmation(allSlots, requestRow, teacherId, teacherMessage = '') {
  if (!allSlots?.length || !allSlots[0]?.email || !isEmailConfigured()) return;

  const now = new Date().toISOString();
  try {
    const teacher = await getTeacherById(teacherId) || {};
    const safeTeacherMessage = String(teacherMessage || '').trim();

    const branding = await getEmailBranding();
    const { subject, text, html } = buildEmail('confirmation-multi', {
      date: allSlots[0].date,
      slots: allSlots.map(s => ({ time: s.time })),
      teacherName: teacher.name,
      teacherMessage: safeTeacherMessage,
    }, branding);
    await sendMail({ to: allSlots[0].email, subject, text, html });

    for (const slot of allSlots) {
      await db.updateTable('slots')
        .set({ confirmation_sent_at: now })
        .where('id', '=', slot.id)
        .execute();
    }
    await db.updateTable('booking_requests')
      .set({ confirmation_sent_at: now, updated_at: now })
      .where('id', '=', requestRow.id)
      .execute();
  } catch (e) {
    logger.warn({ err: e }, 'Sending multi-slot confirmation email failed');
  }
}

// ── Core assignment logic ───────────────────────────────────────────────

export async function assignRequestToSlot(current, teacherId, preferredTime = null, teacherMessage = '', options = {}) {
  const candidateTimes = buildAssignableSlotTimesFromRequestedWindow(current.requested_time);
  const normalizedPreferredTime = typeof preferredTime === 'string' ? preferredTime.trim() : '';
  if (normalizedPreferredTime && !isValidSlotTimeRange(normalizedPreferredTime)) {
    return { ok: false, code: 'INVALID_TIME_SELECTION', candidateTimes };
  }

  const orderedTimes = [];
  if (normalizedPreferredTime) orderedTimes.push(normalizedPreferredTime);
  for (const t of candidateTimes) {
    if (!orderedTimes.includes(t)) orderedTimes.push(t);
  }

  if (!orderedTimes.length) {
    const anyFreeSlots = await db.selectFrom('slots')
      .select(['time'])
      .where('teacher_id', '=', teacherId)
      .where('date', '=', current.date)
      .where('booked', '=', false)
      .orderBy('time', 'asc')
      .limit(50)
      .execute();
    if (!anyFreeSlots?.length) {
      return { ok: false, code: 'NO_SLOT_AVAILABLE' };
    }
    for (const s of anyFreeSlots) {
      if (!orderedTimes.includes(s.time)) orderedTimes.push(s.time);
    }
  }

  const slotRows = await db.selectFrom('slots')
    .select(['id', 'time', 'event_id'])
    .where('teacher_id', '=', teacherId)
    .where('date', '=', current.date)
    .where('booked', '=', false)
    .where('time', '=', sql`ANY(${orderedTimes})`)
    .limit(50)
    .execute();

  const slot = pickPreferredSlot(slotRows, orderedTimes, current.event_id ?? null);
  if (!slot) {
    const eventIds = Array.from(new Set((slotRows || []).map((r) => r.event_id)));
    return {
      ok: false,
      code: 'NO_SLOT_AVAILABLE',
      details: {
        requestEventId: current.event_id ?? null,
        teacherId,
        date: current.date,
        requestedTime: current.requested_time,
        candidateTimes: orderedTimes,
        matchingSlotsFound: (slotRows || []).length,
        matchingEventIds: eventIds,
      },
    };
  }

  const now = new Date().toISOString();
  const slotUpdate = buildSlotUpdateFromRequest(current, slot, now);

  // Wrap both UPDATEs in a Kysely transaction to prevent inconsistent state
  const txResult = await db.transaction().execute(async (trx) => {
    const updatedSlotRows = await sql`
      UPDATE slots SET
        event_id = ${slotUpdate.event_id},
        booked = ${slotUpdate.booked},
        status = ${slotUpdate.status},
        visitor_type = ${slotUpdate.visitor_type},
        class_name = ${slotUpdate.class_name},
        email = ${slotUpdate.email},
        message = ${slotUpdate.message},
        parent_name = ${slotUpdate.parent_name},
        student_name = ${slotUpdate.student_name},
        company_name = ${slotUpdate.company_name},
        trainee_name = ${slotUpdate.trainee_name},
        representative_name = ${slotUpdate.representative_name},
        verified_at = ${slotUpdate.verified_at},
        verification_token_hash = ${slotUpdate.verification_token_hash},
        verification_sent_at = ${slotUpdate.verification_sent_at},
        updated_at = ${slotUpdate.updated_at}
      WHERE id = ${slot.id} AND teacher_id = ${teacherId} AND booked = false
      RETURNING *
    `.execute(trx);

    if (updatedSlotRows.rows.length === 0) {
      return { ok: false, code: 'SLOT_ALREADY_BOOKED' };
    }
    const updatedSlot = updatedSlotRows.rows[0];

    const updatedReqRows = await sql`
      UPDATE booking_requests SET status = 'accepted', assigned_slot_id = ${updatedSlot.id}, updated_at = ${now}
      WHERE id = ${current.id} AND teacher_id = ${teacherId} AND status = 'requested'
      RETURNING *
    `.execute(trx);

    if (updatedReqRows.rows.length === 0) {
      return { ok: false, code: 'REQUEST_NOT_PENDING_ANYMORE' };
    }
    const updatedReq = updatedReqRows.rows[0];

    return { ok: true, updatedSlot, updatedReq };
  });

  if (!txResult.ok) {
    return txResult;
  }

  // Email sending outside transaction -- non-critical
  if (!options.skipEmail) {
    await sendRequestConfirmationIfPossible(txResult.updatedSlot, txResult.updatedReq, teacherId, now, teacherMessage);
  }
  return txResult;
}

export async function assignExtraSlot(requestRow, teacherId, preferredTime) {
  const normalizedTime = typeof preferredTime === 'string' ? preferredTime.trim() : '';
  if (!normalizedTime || !isValidSlotTimeRange(normalizedTime)) {
    return { ok: false, code: 'INVALID_TIME_SELECTION' };
  }

  const slotRows = await db.selectFrom('slots')
    .select(['id', 'time', 'event_id'])
    .where('teacher_id', '=', teacherId)
    .where('date', '=', requestRow.date)
    .where('booked', '=', false)
    .where('time', '=', normalizedTime)
    .limit(10)
    .execute();

  const slot = pickPreferredSlot(slotRows, [normalizedTime], requestRow.event_id ?? null);
  if (!slot) {
    return { ok: false, code: 'NO_SLOT_AVAILABLE' };
  }

  const now = new Date().toISOString();
  const slotUpdate = buildSlotUpdateFromRequest(requestRow, slot, now);

  // Wrap in Kysely transaction for consistency with assignRequestToSlot
  const txResult = await db.transaction().execute(async (trx) => {
    const updatedSlotRows = await sql`
      UPDATE slots SET
        event_id = ${slotUpdate.event_id},
        booked = ${slotUpdate.booked},
        status = ${slotUpdate.status},
        visitor_type = ${slotUpdate.visitor_type},
        class_name = ${slotUpdate.class_name},
        email = ${slotUpdate.email},
        message = ${slotUpdate.message},
        parent_name = ${slotUpdate.parent_name},
        student_name = ${slotUpdate.student_name},
        company_name = ${slotUpdate.company_name},
        trainee_name = ${slotUpdate.trainee_name},
        representative_name = ${slotUpdate.representative_name},
        verified_at = ${slotUpdate.verified_at},
        verification_token_hash = ${slotUpdate.verification_token_hash},
        verification_sent_at = ${slotUpdate.verification_sent_at},
        updated_at = ${slotUpdate.updated_at}
      WHERE id = ${slot.id} AND teacher_id = ${teacherId} AND booked = false
      RETURNING *
    `.execute(trx);

    if (updatedSlotRows.rows.length === 0) {
      return { ok: false, code: 'SLOT_ALREADY_BOOKED' };
    }

    return { ok: true, updatedSlot: updatedSlotRows.rows[0] };
  });

  return txResult;
}
