import { query, getClient } from '../../../../../config/db.js';
import { isEmailConfigured, sendMail } from '../../../../../config/email.js';
import { buildEmail, getEmailBranding } from '../../../../../emails/template.js';
import { getTeacherById } from '../../../services/teachersService.js';
import { assertSafeIdentifier } from '../../../../../shared/sqlGuards.js';
import logger from '../../../../../config/logger.js';

// ── Time parsing helpers ────────────────────────────────────────────────

function parseTimeWindow(timeWindow) {
  if (typeof timeWindow !== 'string') return null;
  const m = timeWindow.trim().match(/^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/);
  if (!m) return null;
  const start = Number.parseInt(m[1], 10) * 60 + Number.parseInt(m[2], 10);
  const end = Number.parseInt(m[3], 10) * 60 + Number.parseInt(m[4], 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

function fmtMinutes(mins) {
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

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
  const { rows } = await query(
    'SELECT available_from, available_until FROM teachers WHERE id = $1',
    [teacherId]
  );
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
    await query('UPDATE slots SET confirmation_sent_at = $1 WHERE id = $2', [now, updatedSlot.id]);
    await query('UPDATE booking_requests SET confirmation_sent_at = $1, updated_at = $1 WHERE id = $2', [now, requestRow.id]);
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
      await query('UPDATE slots SET confirmation_sent_at = $1 WHERE id = $2', [now, slot.id]);
    }
    await query('UPDATE booking_requests SET confirmation_sent_at = $1, updated_at = $1 WHERE id = $2', [now, requestRow.id]);
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
    const { rows: anyFreeSlots } = await query(
      `SELECT time FROM slots
       WHERE teacher_id = $1 AND date = $2 AND booked = false
       ORDER BY time ASC LIMIT 50`,
      [teacherId, current.date]
    );
    if (!anyFreeSlots?.length) {
      return { ok: false, code: 'NO_SLOT_AVAILABLE' };
    }
    for (const s of anyFreeSlots) {
      if (!orderedTimes.includes(s.time)) orderedTimes.push(s.time);
    }
  }

  const { rows: slotRows } = await query(
    `SELECT id, time, event_id FROM slots
     WHERE teacher_id = $1 AND date = $2 AND booked = false AND time = ANY($3)
     LIMIT 50`,
    [teacherId, current.date, orderedTimes]
  );

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

  const slotUpdateKeys = Object.keys(slotUpdate);
  slotUpdateKeys.forEach((k) => assertSafeIdentifier(k, `slotAssignment slotUpdate key: ${k}`));
  const slotSetClauses = slotUpdateKeys.map((k, i) => `${k} = $${i + 1}`);
  const slotValues = slotUpdateKeys.map((k) => slotUpdate[k]);
  const slotOffset = slotValues.length;

  // Wrap both UPDATEs in a transaction to prevent inconsistent state
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: updatedSlotRows } = await client.query(
      `UPDATE slots SET ${slotSetClauses.join(', ')}
       WHERE id = $${slotOffset + 1} AND teacher_id = $${slotOffset + 2} AND booked = false
       RETURNING *`,
      [...slotValues, slot.id, teacherId]
    );

    if (updatedSlotRows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'SLOT_ALREADY_BOOKED' };
    }
    const updatedSlot = updatedSlotRows[0];

    const { rows: updatedReqRows } = await client.query(
      `UPDATE booking_requests SET status = 'accepted', assigned_slot_id = $1, updated_at = $2
       WHERE id = $3 AND teacher_id = $4 AND status = 'requested'
       RETURNING *`,
      [updatedSlot.id, now, current.id, teacherId]
    );

    if (updatedReqRows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'REQUEST_NOT_PENDING_ANYMORE' };
    }
    const updatedReq = updatedReqRows[0];

    await client.query('COMMIT');

    // Email sending outside transaction – non-critical
    if (!options.skipEmail) {
      await sendRequestConfirmationIfPossible(updatedSlot, updatedReq, teacherId, now, teacherMessage);
    }
    return { ok: true, updatedSlot, updatedReq };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function assignExtraSlot(requestRow, teacherId, preferredTime) {
  const normalizedTime = typeof preferredTime === 'string' ? preferredTime.trim() : '';
  if (!normalizedTime || !isValidSlotTimeRange(normalizedTime)) {
    return { ok: false, code: 'INVALID_TIME_SELECTION' };
  }

  const { rows: slotRows } = await query(
    `SELECT id, time, event_id FROM slots
     WHERE teacher_id = $1 AND date = $2 AND booked = false AND time = $3
     LIMIT 10`,
    [teacherId, requestRow.date, normalizedTime]
  );

  const slot = pickPreferredSlot(slotRows, [normalizedTime], requestRow.event_id ?? null);
  if (!slot) {
    return { ok: false, code: 'NO_SLOT_AVAILABLE' };
  }

  const now = new Date().toISOString();
  const slotUpdate = buildSlotUpdateFromRequest(requestRow, slot, now);

  const extraKeys = Object.keys(slotUpdate);
  extraKeys.forEach((k) => assertSafeIdentifier(k, `slotAssignment extraSlot key: ${k}`));
  const extraSet = extraKeys.map((k, i) => `${k} = $${i + 1}`);
  const extraVals = extraKeys.map((k) => slotUpdate[k]);
  const extraOff = extraVals.length;

  // Wrap in transaction for consistency with assignRequestToSlot
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: updatedSlotRows } = await client.query(
      `UPDATE slots SET ${extraSet.join(', ')}
       WHERE id = $${extraOff + 1} AND teacher_id = $${extraOff + 2} AND booked = false
       RETURNING *`,
      [...extraVals, slot.id, teacherId]
    );

    if (updatedSlotRows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'SLOT_ALREADY_BOOKED' };
    }

    await client.query('COMMIT');
    return { ok: true, updatedSlot: updatedSlotRows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
