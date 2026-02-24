import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../config/db.js';
import { isEmailConfigured, sendMail } from '../config/email.js';
import bcrypt from 'bcryptjs';
import { mapSlotRow, mapBookingRowWithTeacher, mapBookingRequestRow } from '../utils/mappers.js';

function buildHalfHourWindows(startHour, endHour) {
  const windows = [];
  const pad2 = (n) => String(n).padStart(2, '0');
  const toMins = (h, m) => h * 60 + m;
  const fmt = (mins) => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;

  const start = toMins(startHour, 0);
  const end = toMins(endHour, 0);
  for (let m = start; m + 30 <= end; m += 30) {
    windows.push(`${fmt(m)} - ${fmt(m + 30)}`);
  }
  return windows;
}

function getRequestedTimeWindowsForSystem(system) {
  if (system === 'vollzeit') {
    return buildHalfHourWindows(17, 19);
  }
  return buildHalfHourWindows(16, 18);
}

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

function buildAssignableSlotTimesFromRequestedWindow(requestedTime, slotMinutes = null) {
  const parsed = parseTimeWindow(requestedTime);
  if (!parsed) return [];

  // Infer slot duration from the window size or use the explicit parameter
  const windowSize = parsed.end - parsed.start;
  const dur = slotMinutes && [10, 15, 20, 30].includes(slotMinutes)
    ? slotMinutes
    : (windowSize <= 30 ? windowSize : 15);

  const times = [];
  for (let m = parsed.start; m + dur <= parsed.end; m += dur) {
    times.push(`${fmtMinutes(m)} - ${fmtMinutes(m + dur)}`);
  }

  // Backward compatibility: if the window exactly equals one slot, keep it assignable.
  if (!times.length && windowSize > 0) {
    return [`${fmtMinutes(parsed.start)} - ${fmtMinutes(parsed.end)}`];
  }
  return times;
}

function buildAssignableSlotTimesForSystem(system) {
  const windows = getRequestedTimeWindowsForSystem(system);
  const result = [];
  for (const window of windows) {
    for (const t of buildAssignableSlotTimesFromRequestedWindow(window)) {
      if (!result.includes(t)) result.push(t);
    }
  }
  return result;
}

async function getTeacherSystem(teacherId) {
  const { rows } = await query(
    'SELECT system FROM teachers WHERE id = $1',
    [teacherId]
  );
  if (rows.length === 0) throw new Error('Teacher not found');
  return rows[0]?.system === 'vollzeit' ? 'vollzeit' : 'dual';
}

function isValidSlotTimeRange(value) {
  return /^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/.test(String(value || '').trim());
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pickPreferredSlot(slotRows, orderedTimes, eventId) {
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

async function sendRequestConfirmationIfPossible(updatedSlot, requestRow, teacherId, now, teacherMessage = '') {
  if (!updatedSlot?.email || !isEmailConfigured()) return;

  try {
    const { rows: teacherRows } = await query('SELECT * FROM teachers WHERE id = $1', [teacherId]);
    const teacher = teacherRows[0] || {};
    const safeTeacherMessage = String(teacherMessage || '').trim();
    const teacherMessagePlain = safeTeacherMessage
      ? `\n\nNachricht der Lehrkraft:\n${safeTeacherMessage}`
      : '';
    const teacherMessageHtml = safeTeacherMessage
      ? `<p><strong>Nachricht der Lehrkraft:</strong><br/>${escapeHtml(safeTeacherMessage).replace(/\n/g, '<br/>')}</p>`
      : '';
    const subject = `BKSB Elternsprechtag – Termin bestätigt am ${updatedSlot.date} (${updatedSlot.time})`;
    const plain = `Guten Tag,

Ihre Terminanfrage wurde durch die Lehrkraft angenommen.

Termin: ${updatedSlot.date} ${updatedSlot.time}
Lehrkraft: ${teacher.name || '—'}
Raum: ${teacher.room || '—'}

${teacherMessagePlain}

Mit freundlichen Grüßen

Ihr BKSB-Team`;
    const html = `<p>Guten Tag,</p>
<p>Ihre Terminanfrage wurde durch die Lehrkraft angenommen.</p>
<p><strong>Termin:</strong> ${updatedSlot.date} ${updatedSlot.time}<br/>
<strong>Lehrkraft:</strong> ${teacher.name || '—'}<br/>
<strong>Raum:</strong> ${teacher.room || '—'}</p>
${teacherMessageHtml}
<p>Mit freundlichen Grüßen</p>
<p>Ihr BKSB-Team</p>`;

    await sendMail({ to: updatedSlot.email, subject, text: plain, html });
    await query('UPDATE slots SET confirmation_sent_at = $1 WHERE id = $2', [now, updatedSlot.id]);
    await query('UPDATE booking_requests SET confirmation_sent_at = $1, updated_at = $1 WHERE id = $2', [now, requestRow.id]);
  } catch (e) {
    console.warn('Sending request confirmation email failed:', e?.message || e);
  }
}

async function assignRequestToSlot(current, teacherId, preferredTime = null, teacherMessage = '', teacherSystem = null) {
  const candidateTimes = buildAssignableSlotTimesFromRequestedWindow(current.requested_time);
  const normalizedPreferredTime = typeof preferredTime === 'string' ? preferredTime.trim() : '';
  if (normalizedPreferredTime && !isValidSlotTimeRange(normalizedPreferredTime)) {
    return { ok: false, code: 'INVALID_TIME_SELECTION', candidateTimes };
  }

  // Build ordered list of times to try: preferred first, then candidates from window
  const orderedTimes = [];
  if (normalizedPreferredTime) orderedTimes.push(normalizedPreferredTime);
  for (const t of candidateTimes) {
    if (!orderedTimes.includes(t)) orderedTimes.push(t);
  }

  // If no preferred time and no candidates, query all free slots for this teacher+date
  if (!orderedTimes.length) {
    const { rows: anyFreeSlots } = await query(
      `SELECT * FROM slots
       WHERE teacher_id = $1 AND date = $2 AND booked = false
       ORDER BY time ASC LIMIT 50`,
      [teacherId, current.date]
    );
    if (!anyFreeSlots?.length) {
      return { ok: false, code: 'NO_SLOT_AVAILABLE' };
    }
    // Use all free slots as candidates
    for (const s of anyFreeSlots) {
      if (!orderedTimes.includes(s.time)) orderedTimes.push(s.time);
    }
  }

  const { rows: slotRows } = await query(
    `SELECT * FROM slots
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
        teacherSystem: resolvedTeacherSystem,
        date: current.date,
        requestedTime: current.requested_time,
        candidateTimes: systemConformTimes,
        matchingSlotsFound: (slotRows || []).length,
        matchingEventIds: eventIds,
      },
    };
  }

  const now = new Date().toISOString();
  const slotUpdate = {
    event_id: current.event_id ?? slot.event_id ?? null,
    booked: true,
    status: 'confirmed',
    visitor_type: current.visitor_type,
    class_name: current.class_name,
    email: current.email,
    message: current.message || null,
    parent_name: current.parent_name,
    student_name: current.student_name,
    company_name: current.company_name,
    trainee_name: current.trainee_name,
    representative_name: current.representative_name,
    verified_at: current.verified_at,
    verification_token: null,
    verification_token_hash: null,
    verification_sent_at: null,
    updated_at: now,
  };

  const slotUpdateKeys = Object.keys(slotUpdate);
  const slotSetClauses = slotUpdateKeys.map((k, i) => `${k} = $${i + 1}`);
  const slotValues = slotUpdateKeys.map((k) => slotUpdate[k]);
  const slotOffset = slotValues.length;

  const { rows: updatedSlotRows } = await query(
    `UPDATE slots SET ${slotSetClauses.join(', ')}
     WHERE id = $${slotOffset + 1} AND teacher_id = $${slotOffset + 2} AND booked = false
     RETURNING *`,
    [...slotValues, slot.id, teacherId]
  );

  if (updatedSlotRows.length === 0) {
    return { ok: false, code: 'SLOT_ALREADY_BOOKED' };
  }
  const updatedSlot = updatedSlotRows[0];

  const { rows: updatedReqRows } = await query(
    `UPDATE booking_requests SET status = 'accepted', assigned_slot_id = $1, updated_at = $2
     WHERE id = $3 AND teacher_id = $4 AND status = 'requested'
     RETURNING *`,
    [updatedSlot.id, now, current.id, teacherId]
  );

  if (updatedReqRows.length === 0) {
    return { ok: false, code: 'REQUEST_NOT_PENDING_ANYMORE' };
  }
  const updatedReq = updatedReqRows[0];

  await sendRequestConfirmationIfPossible(updatedSlot, updatedReq, teacherId, now, teacherMessage);
  return { ok: true, updatedSlot, updatedReq };
}

async function autoAssignOverdueRequestsForTeacher(teacherId) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { rows: overdueRequests } = await query(
    `SELECT * FROM booking_requests
     WHERE teacher_id = $1 AND status = 'requested' AND verified_at IS NOT NULL AND created_at <= $2
     ORDER BY created_at ASC LIMIT 200`,
    [teacherId, cutoff]
  );
  if (error) throw error;

  for (const reqRow of overdueRequests || []) {
    try {
      await assignRequestToSlot(reqRow, teacherId, null);
    } catch (e) {
      console.warn('Auto-assignment for overdue request failed:', e?.message || e);
    }
  }
}

async function autoAssignOverdueRequestsGlobal() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { rows: overdueRequests } = await query(
    `SELECT * FROM booking_requests
     WHERE status = 'requested' AND verified_at IS NOT NULL AND created_at <= $1
     ORDER BY created_at ASC LIMIT 500`,
    [cutoff]
  );

  for (const reqRow of overdueRequests || []) {
    try {
      await assignRequestToSlot(reqRow, reqRow.teacher_id, null);
    } catch (e) {
      console.warn('Global auto-assignment failed:', e?.message || e);
    }
  }
}

const autoAssignIntervalMs = 5 * 60 * 1000;
const autoAssignTimer = setInterval(() => {
  autoAssignOverdueRequestsGlobal().catch((e) => {
    console.warn('Auto-assignment sweep failed:', e?.message || e);
  });
}, autoAssignIntervalMs);

if (typeof autoAssignTimer.unref === 'function') {
  autoAssignTimer.unref();
}

const router = express.Router();

/**
 * Middleware: Require teacher role
 */
function requireTeacher(req, res, next) {
  if (req.user && (req.user.role === 'teacher' || req.user.role === 'admin')) {
    return next();
  }
  return res.status(403).json({ 
    error: 'Forbidden', 
    message: 'Teacher access required' 
  });
}

/**
 * GET /api/teacher/bookings
 * Get all bookings for the logged-in teacher
 */
router.get('/bookings', requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const { rows: bookingRows } = await query(
      `SELECT s.*, t.name AS teacher_name, t.subject AS teacher_subject
       FROM slots s
       LEFT JOIN teachers t ON s.teacher_id = t.id
       WHERE s.teacher_id = $1 AND s.booked = true
       ORDER BY s.date, s.time`,
      [teacherId]
    );
    
    const bookings = (bookingRows || []).map((r) => {
      const { teacher_name, teacher_subject, ...slot } = r;
      slot.teacher = { name: teacher_name, subject: teacher_subject };
      return mapBookingRowWithTeacher(slot);
    });
  
    res.json({ bookings });
  } catch (error) {
    console.error('Error fetching teacher bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * GET /api/teacher/slots
 * Get all slots for the logged-in teacher
 */
router.get('/slots', requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const { rows: slotData } = await query(
      'SELECT * FROM slots WHERE teacher_id = $1 ORDER BY date, time',
      [teacherId]
    );
    
    const slots = (slotData || []).map(mapSlotRow);
    
    res.json({ slots });
  } catch (error) {
    console.error('Error fetching teacher slots:', error);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

/**
 * GET /api/teacher/requests
 * Get all pending booking requests for the logged-in teacher
 */
router.get('/requests', requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const teacherSystem = await getTeacherSystem(teacherId);

    // Auto-assign verified requests older than 24h to the earliest free slot.
    await autoAssignOverdueRequestsForTeacher(teacherId);

    const { rows: requestData } = await query(
      `SELECT * FROM booking_requests
       WHERE teacher_id = $1 AND status = 'requested'
       ORDER BY created_at DESC LIMIT 500`,
      [teacherId]
    );

    return res.json({
      requests: await (async () => {
        const rows = requestData || [];
        const dates = Array.from(new Set(rows.map((row) => row.date).filter(Boolean)));

        let allFreeSlots = [];
        if (dates.length) {
          const { rows: freeSlotRows } = await query(
            `SELECT time, date FROM slots
             WHERE teacher_id = $1 AND booked = false AND date = ANY($2)
             ORDER BY time ASC LIMIT 3000`,
            [teacherId, dates]
          );
          allFreeSlots = freeSlotRows || [];
        }

        return rows.map((row) => {
          const scopedFreeTimes = allFreeSlots
            .filter((slot) => slot.date === row.date)
            .map((slot) => slot.time)
            .filter((value, index, arr) => arr.indexOf(value) === index);

          return {
            ...mapBookingRequestRow(row),
            assignableTimes: buildAssignableSlotTimesFromRequestedWindow(row.requested_time),
            availableTimes: scopedFreeTimes,
          };
        });
      })(),
    });
  } catch (error) {
    console.error('Error fetching teacher requests:', error);
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

/**
 * Assign an additional slot for the same booking request (multi-slot).
 * Unlike assignRequestToSlot, this does NOT update the booking_requests row — only books the slot.
 */
async function assignExtraSlot(requestRow, teacherId, preferredTime) {
  const normalizedTime = typeof preferredTime === 'string' ? preferredTime.trim() : '';
  if (!normalizedTime || !isValidSlotTimeRange(normalizedTime)) {
    return { ok: false, code: 'INVALID_TIME_SELECTION' };
  }

  const { rows: slotRows } = await query(
    `SELECT * FROM slots
     WHERE teacher_id = $1 AND date = $2 AND booked = false AND time = $3
     LIMIT 10`,
    [teacherId, requestRow.date, normalizedTime]
  );

  const slot = pickPreferredSlot(slotRows, [normalizedTime], requestRow.event_id ?? null);
  if (!slot) {
    return { ok: false, code: 'NO_SLOT_AVAILABLE' };
  }

  const now = new Date().toISOString();
  const slotUpdate = {
    event_id: requestRow.event_id ?? slot.event_id ?? null,
    booked: true,
    status: 'confirmed',
    visitor_type: requestRow.visitor_type,
    class_name: requestRow.class_name,
    email: requestRow.email,
    message: requestRow.message || null,
    parent_name: requestRow.parent_name,
    student_name: requestRow.student_name,
    company_name: requestRow.company_name,
    trainee_name: requestRow.trainee_name,
    representative_name: requestRow.representative_name,
    verified_at: requestRow.verified_at,
    verification_token: null,
    verification_token_hash: null,
    verification_sent_at: null,
    updated_at: now,
  };

  const extraKeys = Object.keys(slotUpdate);
  const extraSet = extraKeys.map((k, i) => `${k} = $${i + 1}`);
  const extraVals = extraKeys.map((k) => slotUpdate[k]);
  const extraOff = extraVals.length;

  const { rows: updatedSlotRows } = await query(
    `UPDATE slots SET ${extraSet.join(', ')}
     WHERE id = $${extraOff + 1} AND teacher_id = $${extraOff + 2} AND booked = false
     RETURNING *`,
    [...extraVals, slot.id, teacherId]
  );

  if (updatedSlotRows.length === 0) {
    return { ok: false, code: 'SLOT_ALREADY_BOOKED' };
  }

  return { ok: true, updatedSlot: updatedSlotRows[0] };
}

/**
 * Send a single confirmation email listing all assigned slot times (multi-slot).
 * Replaces the individual email that was already sent for the first slot.
 */
async function sendMultiSlotConfirmation(allSlots, requestRow, teacherId, teacherMessage = '') {
  if (!allSlots?.length || !allSlots[0]?.email || !isEmailConfigured()) return;

  try {
    const { rows: teacherRows } = await query('SELECT * FROM teachers WHERE id = $1', [teacherId]);
    const teacher = teacherRows[0] || {};
    const safeTeacherMessage = String(teacherMessage || '').trim();
    const teacherMessagePlain = safeTeacherMessage
      ? `\n\nNachricht der Lehrkraft:\n${safeTeacherMessage}`
      : '';
    const teacherMessageHtml = safeTeacherMessage
      ? `<p><strong>Nachricht der Lehrkraft:</strong><br/>${escapeHtml(safeTeacherMessage).replace(/\n/g, '<br/>')}</p>`
      : '';

    const timesFormatted = allSlots.map((s) => s.time).join(', ');
    const timesListPlain = allSlots.map((s, i) => `  ${i + 1}. ${s.time}`).join('\n');
    const timesListHtml = allSlots.map((s) => `<li>${s.time}</li>`).join('');

    const subject = `BKSB Elternsprechtag – ${allSlots.length} Termine bestätigt am ${allSlots[0].date} (${timesFormatted})`;
    const plain = `Guten Tag,

Ihre Terminanfrage wurde durch die Lehrkraft angenommen.

Es wurden ${allSlots.length} Termine für Sie vergeben:
${timesListPlain}

Datum: ${allSlots[0].date}
Lehrkraft: ${teacher.name || '—'}
Raum: ${teacher.room || '—'}
${teacherMessagePlain}

Mit freundlichen Grüßen

Ihr BKSB-Team`;

    const html = `<p>Guten Tag,</p>
<p>Ihre Terminanfrage wurde durch die Lehrkraft angenommen.</p>
<p>Es wurden <strong>${allSlots.length} Termine</strong> für Sie vergeben:</p>
<ul>${timesListHtml}</ul>
<p><strong>Datum:</strong> ${allSlots[0].date}<br/>
<strong>Lehrkraft:</strong> ${teacher.name || '—'}<br/>
<strong>Raum:</strong> ${teacher.room || '—'}</p>
${teacherMessageHtml}
<p>Mit freundlichen Grüßen</p>
<p>Ihr BKSB-Team</p>`;

    const now = new Date().toISOString();
    await sendMail({ to: allSlots[0].email, subject, text: plain, html });

    // Mark all slots as confirmation sent
    for (const slot of allSlots) {
      await query('UPDATE slots SET confirmation_sent_at = $1 WHERE id = $2', [now, slot.id]);
    }
    await query('UPDATE booking_requests SET confirmation_sent_at = $1, updated_at = $1 WHERE id = $2', [now, requestRow.id]);
  } catch (e) {
    console.warn('Sending multi-slot confirmation email failed:', e?.message || e);
  }
}

/**
 * PUT /api/teacher/requests/:id/accept
 * Accept a verified booking request and assign it to one or more slots
 * Body (optional): { time?: string, times?: string[], teacherMessage?: string }
 * - 'times' is an array of slot times to assign (multi-slot booking)
 * - 'time' is kept for backward compatibility (single slot)
 */
router.put('/requests/:id/accept', requireAuth, requireTeacher, async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  if (isNaN(requestId)) {
    return res.status(400).json({ error: 'Invalid request id' });
  }

  try {
    const teacherId = req.user.teacherId;
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const { rows: currentRows } = await query(
      'SELECT * FROM booking_requests WHERE id = $1 AND teacher_id = $2',
      [requestId, teacherId]
    );
    const current = currentRows[0] || null;

    if (!current) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (current.status === 'accepted') {
      return res.json({ success: true, request: mapBookingRequestRow(current) });
    }

    if (current.status !== 'requested') {
      return res.status(409).json({ error: 'Request is not pending' });
    }

    if (!current.verified_at) {
      return res.status(409).json({
        error: 'Anfrage kann erst angenommen werden, nachdem die E-Mail-Adresse verifiziert wurde',
      });
    }

    // Support both 'times' (array) and 'time' (single string) for backward compat
    let rawTimes = [];
    if (Array.isArray(req.body?.times) && req.body.times.length > 0) {
      rawTimes = req.body.times.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
    } else if (typeof req.body?.time === 'string' && req.body.time.trim()) {
      rawTimes = [req.body.time.trim()];
    }

    const rawTeacherMessage = typeof req.body?.teacherMessage === 'string' ? req.body.teacherMessage.trim() : '';
    if (rawTeacherMessage.length > 1000) {
      return res.status(400).json({ error: 'Nachricht der Lehrkraft darf maximal 1000 Zeichen lang sein' });
    }

    // Assign first slot using the original assignRequestToSlot (updates booking_requests status)
    const firstTime = rawTimes[0] || null;
    const assignment = await assignRequestToSlot(current, teacherId, firstTime, rawTeacherMessage || '');
    if (!assignment.ok) {
      if (assignment.code === 'INVALID_TIME_SELECTION') {
        return res.status(400).json({ error: 'Ungültige Zeit-Auswahl', assignableTimes: assignment.candidateTimes || [] });
      }
      if (assignment.code === 'INVALID_REQUEST_WINDOW') {
        return res.status(400).json({ error: 'Anfrage-Zeitraum ist ungültig' });
      }
      if (assignment.code === 'NO_SLOT_AVAILABLE') {
        return res.status(409).json({
          error: 'Slot nicht verfügbar. Bitte prüfen, ob Slots für das Event generiert wurden oder ob der Slot bereits vergeben ist.',
          details: assignment.details,
        });
      }
      if (assignment.code === 'SLOT_ALREADY_BOOKED') {
        return res.status(409).json({ error: 'Slot bereits vergeben' });
      }
      if (assignment.code === 'REQUEST_NOT_PENDING_ANYMORE') {
        return res.status(409).json({ error: 'Anfrage ist nicht mehr offen' });
      }
      return res.status(409).json({ error: 'Anfrage konnte nicht angenommen werden' });
    }

    const allSlots = [assignment.updatedSlot];

    // Assign additional slots if multiple times were requested
    if (rawTimes.length > 1) {
      for (let i = 1; i < rawTimes.length; i++) {
        const additionalTime = rawTimes[i];
        try {
          const extraAssignment = await assignExtraSlot(current, teacherId, additionalTime);
          if (extraAssignment.ok) {
            allSlots.push(extraAssignment.updatedSlot);
          } else {
            console.warn(`Multi-slot assignment: could not assign additional slot for time ${additionalTime}:`, extraAssignment.code);
          }
        } catch (e) {
          console.warn(`Multi-slot assignment: error assigning time ${additionalTime}:`, e?.message || e);
        }
      }
    }

    // If multiple slots were assigned, send a combined confirmation email
    if (allSlots.length > 1) {
      await sendMultiSlotConfirmation(allSlots, assignment.updatedReq, teacherId, rawTeacherMessage);
    }

    return res.json({
      success: true,
      request: mapBookingRequestRow(assignment.updatedReq),
      slot: mapSlotRow(assignment.updatedSlot),
      slots: allSlots.map(mapSlotRow),
    });
  } catch (error) {
    console.error('Error accepting booking request:', error);
    return res.status(500).json({ error: 'Failed to accept request' });
  }
});

/**
 * PUT /api/teacher/requests/:id/decline
 */
router.put('/requests/:id/decline', requireAuth, requireTeacher, async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  if (isNaN(requestId)) {
    return res.status(400).json({ error: 'Invalid request id' });
  }

  try {
    const teacherId = req.user.teacherId;
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const now = new Date().toISOString();
    const { rows: declineRows } = await query(
      `UPDATE booking_requests SET status = 'declined', updated_at = $1
       WHERE id = $2 AND teacher_id = $3 AND status = 'requested'
       RETURNING *`,
      [now, requestId, teacherId]
    );

    if (declineRows.length === 0) {
      return res.status(404).json({ error: 'Request not found or not pending' });
    }

    return res.json({ success: true, request: mapBookingRequestRow(declineRows[0]) });
  } catch (error) {
    console.error('Error declining booking request:', error);
    return res.status(500).json({ error: 'Failed to decline request' });
  }
});

/**
 * GET /api/teacher/info
 * Get info about the logged-in teacher
 */
router.get('/info', requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const { rows: teacherInfoRows } = await query(
      'SELECT * FROM teachers WHERE id = $1',
      [teacherId]
    );
    const data = teacherInfoRows[0];
    
    if (!data) throw new Error('Teacher not found');
    
    res.json({ 
      teacher: {
        id: data.id,
        name: data.name,
        email: data.email,
        salutation: data.salutation,
        subject: data.subject,
        system: data.system,
        room: data.room
      }
    });
  } catch (error) {
    console.error('Error fetching teacher info:', error);
    res.status(500).json({ error: 'Failed to fetch teacher info' });
  }
});

/**
 * PUT /api/teacher/room
 * Body: { room?: string | null }
 * Allows logged-in teacher to update their own room.
 */
router.put('/room', requireAuth, requireTeacher, async (req, res) => {
  try {
    // Feature intentionally disabled (historic reasons). Keep endpoint present but unavailable.
    return res.status(404).json({ error: 'Not found' });

    const teacherId = req.user.teacherId;
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const rawRoom = req.body?.room;
    const nextRoom = typeof rawRoom === 'string'
      ? rawRoom.trim()
      : rawRoom == null
        ? null
        : String(rawRoom).trim();

    if (typeof nextRoom === 'string' && nextRoom.length > 60) {
      return res.status(400).json({ error: 'Raum darf maximal 60 Zeichen lang sein' });
    }

    const roomValue = nextRoom && nextRoom.length ? nextRoom : null;

    const { rows: roomRows } = await query(
      'UPDATE teachers SET room = $1 WHERE id = $2 RETURNING id, name, subject, system, room',
      [roomValue, teacherId]
    );
    const data = roomRows[0];

    if (!data) throw new Error('Teacher not found');

    return res.json({
      success: true,
      teacher: {
        id: data.id,
        name: data.name,
        subject: data.subject,
        system: data.system,
        room: data.room,
      },
    });
  } catch (error) {
    console.error('Error updating teacher room:', error);
    return res.status(500).json({ error: 'Failed to update teacher room' });
  }
});

/**
 * POST /api/teacher/feedback
 * Body: { message: string }
 * Stores anonymous feedback (no teacher reference) for admin review.
 */
router.post('/feedback', requireAuth, requireTeacher, async (req, res) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
      return res.status(400).json({ error: 'Bitte eine Nachricht eingeben.' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Nachricht darf maximal 2000 Zeichen lang sein.' });
    }

    const { rows: feedbackRows } = await query(
      'INSERT INTO feedback (message) VALUES ($1) RETURNING id, message, created_at',
      [message]
    );
    const data = feedbackRows[0];

    return res.json({ success: true, feedback: data });
  } catch (error) {
    console.error('Error creating feedback:', error);
    return res.status(500).json({ error: 'Feedback konnte nicht gespeichert werden.' });
  }
});

/**
 * DELETE /api/teacher/bookings/:slotId
 * Cancel a booking (teacher can cancel their own bookings)
 */
router.delete('/bookings/:slotId', requireAuth, requireTeacher, async (req, res) => {
  const slotId = parseInt(req.params.slotId, 10);
  
  if (isNaN(slotId)) {
    return res.status(400).json({ error: 'Invalid slotId' });
  }

  try {
    const teacherId = req.user.teacherId;
    
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    // Load current booking data first (needed for cancellation email)
    const { rows: currentRows } = await query(
      'SELECT * FROM slots WHERE id = $1 AND teacher_id = $2 AND booked = true',
      [slotId, teacherId]
    );
    const current = currentRows[0] || null;

    if (!current) {
      return res.status(404).json({ error: 'Slot not found, not booked, or not yours' });
    }

    // Clear booking data, but only for own slots
    const { rows: clearedRows } = await query(
      `UPDATE slots SET
         booked = false, status = NULL, visitor_type = NULL,
         parent_name = NULL, company_name = NULL, student_name = NULL,
         trainee_name = NULL, representative_name = NULL, class_name = NULL,
         email = NULL, message = NULL,
         verification_token = NULL, verification_token_hash = NULL,
         verification_sent_at = NULL, verified_at = NULL,
         confirmation_sent_at = NULL,
         updated_at = $1
       WHERE id = $2 AND teacher_id = $3 AND booked = true
       RETURNING *`,
      [new Date().toISOString(), slotId, teacherId]
    );
    
    if (clearedRows.length === 0) {
      return res.status(404).json({ error: 'Slot not found, not booked, or not yours' });
    }

    // Best-effort cancellation email (only if the booking email was verified)
    if (current && current.email && current.verified_at && isEmailConfigured()) {
      try {
        const { rows: tcRows } = await query('SELECT * FROM teachers WHERE id = $1', [teacherId]);
        const teacher = tcRows[0] || {};
        const subject = `BKSB Elternsprechtag – Termin storniert am ${current.date} (${current.time})`;
        const plain = `Guten Tag,

      wir bestätigen Ihnen die Stornierung Ihres Termins.

      Termin: ${current.date} ${current.time}
      Lehrkraft: ${teacher.name || '—'}
      Raum: ${teacher.room || '—'}

      Wenn Sie einen neuen Termin vereinbaren möchten, können Sie dies jederzeit über das Buchungssystem tun.

      Mit freundlichen Grüßen

      Ihr BKSB-Team`;
        const html = `<p>Guten Tag,</p>
      <p>wir bestätigen Ihnen die Stornierung Ihres Termins.</p>
      <p><strong>Termin:</strong> ${current.date} ${current.time}<br/>
      <strong>Lehrkraft:</strong> ${teacher.name || '—'}<br/>
      <strong>Raum:</strong> ${teacher.room || '—'}</p>
      <p>Wenn Sie einen neuen Termin vereinbaren möchten, können Sie dies jederzeit über das Buchungssystem tun.</p>
      <p>Mit freundlichen Grüßen</p>
      <p>Ihr BKSB-Team</p>`;
        await sendMail({ to: current.email, subject, text: plain, html });
        await query('UPDATE slots SET cancellation_sent_at = $1 WHERE id = $2', [new Date().toISOString(), slotId]);
      } catch (e) {
        console.warn('Sending cancellation email (teacher) failed:', e?.message || e);
      }
    }

    res.json({ 
      success: true, 
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

/**
 * PUT /api/teacher/bookings/:slotId/accept
 * Accept a reserved booking (set status to confirmed)
 */
router.put('/bookings/:slotId/accept', requireAuth, requireTeacher, async (req, res) => {
  const slotId = parseInt(req.params.slotId, 10);
  if (isNaN(slotId)) {
    return res.status(400).json({ error: 'Invalid slotId' });
  }

  try {
    const teacherId = req.user.teacherId;
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    // Load current state first (needed to enforce email verification before confirmation)
    const { rows: acceptRows } = await query(
      'SELECT * FROM slots WHERE id = $1 AND teacher_id = $2 AND booked = true',
      [slotId, teacherId]
    );
    const current = acceptRows[0] || null;

    if (!current) {
      return res.status(404).json({ error: 'Slot not found or not booked' });
    }

    if (current?.status === 'confirmed') {
      return res.json({ success: true, slot: current });
    }

    if (!current?.verified_at) {
      return res.status(409).json({
        error: 'Buchung kann erst bestätigt werden, nachdem die E-Mail-Adresse verifiziert wurde',
      });
    }

    // Update status to confirmed
    const { rows: confirmRows } = await query(
      `UPDATE slots SET status = 'confirmed', updated_at = $1
       WHERE id = $2 AND teacher_id = $3 AND booked = true
       RETURNING *`,
      [new Date().toISOString(), slotId, teacherId]
    );
    const data = confirmRows[0] || null;

    if (!data) {
      return res.status(404).json({ error: 'Slot not found or not booked' });
    }

    // If visitor already verified and we haven't sent confirmation, send now
    if (data && data.verified_at && !data.confirmation_sent_at && isEmailConfigured()) {
      try {
        const { rows: teachConfirmRows } = await query('SELECT * FROM teachers WHERE id = $1', [teacherId]);
        const teacher = teachConfirmRows[0] || {};
        const subject = `BKSB Elternsprechtag – Termin bestätigt am ${data.date} (${data.time})`;
        const plain = `Guten Tag,

      Ihre Terminbuchung wurde durch die Lehrkraft bestätigt.

      Termin: ${data.date} ${data.time}
      Lehrkraft: ${teacher.name || '—'}
      Raum: ${teacher.room || '—'}

      Mit freundlichen Grüßen

      Ihr BKSB-Team`;
        const html = `<p>Guten Tag,</p>
      <p>Ihre Terminbuchung wurde durch die Lehrkraft bestätigt.</p>
      <p><strong>Termin:</strong> ${data.date} ${data.time}<br/>
      <strong>Lehrkraft:</strong> ${teacher.name || '—'}<br/>
      <strong>Raum:</strong> ${teacher.room || '—'}</p>
      <p>Mit freundlichen Grüßen</p>
      <p>Ihr BKSB-Team</p>`;
        await sendMail({ to: data.email, subject, text: plain, html });
        await query('UPDATE slots SET confirmation_sent_at = $1 WHERE id = $2', [new Date().toISOString(), data.id]);
      } catch (e) {
        console.warn('Sending confirmation email failed:', e?.message || e);
      }
    }

    res.json({ success: true, slot: data });
  } catch (error) {
    console.error('Error accepting booking:', error);
    res.status(500).json({ error: 'Failed to accept booking' });
  }
});

/**
 * PUT /api/teacher/password
 * Body: { currentPassword, newPassword }
 * Allows logged-in teacher to change their own password
 */
router.put('/password', requireAuth, requireTeacher, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 8) {
    return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben' });
  }
  try {
    // Find user by username from token
    const username = req.user.username;
    const { rows: users } = await query(
      'SELECT * FROM users WHERE username = $1 LIMIT 1',
      [username]
    );
    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }
    const user = users[0];

    // Verify current password if provided; require for safety
    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password_hash || ''))) {
      return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });
    }

    const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);

    res.json({ success: true, message: 'Passwort erfolgreich geändert' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Fehler beim Ändern des Passworts' });
  }
});

export default router;
