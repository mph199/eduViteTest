import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import teacherRoutes from './routes/teacher.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import { query } from './config/db.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { isEmailConfigured, sendMail, getLastEmailDebugInfo } from './config/email.js';
import { listTeachers } from './services/teachersService.js';
import {
  listSlotsByTeacherId,
  reserveBooking,
  verifyBookingToken,
  listAdminBookings,
  cancelBookingAdmin,
} from './services/slotsService.js';
import { mapSlotRow } from './utils/mappers.js';

dotenv.config();

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

function buildQuarterHourWindows(startHour, endHour, slotMinutes = 15) {
  const dur = [10, 15, 20, 30].includes(slotMinutes) ? slotMinutes : 15;
  const windows = [];
  const pad2 = (n) => String(n).padStart(2, '0');
  const toMins = (h, m) => h * 60 + m;
  const fmt = (mins) => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;

  const start = toMins(startHour, 0);
  const end = toMins(endHour, 0);
  for (let m = start; m + dur <= end; m += dur) {
    windows.push(`${fmt(m)} - ${fmt(m + dur)}`);
  }
  return windows;
}

function getRequestedTimeWindowsForSystem(system) {
  if (system === 'vollzeit') {
    return buildHalfHourWindows(17, 19);
  }
  return buildHalfHourWindows(16, 18);
}

function formatDateDE(isoOrDate) {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
}

function normalizeAndValidateTeacherEmail(rawEmail) {
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  const isValid = /^[a-z0-9._%+-]+@bksb\.nrw$/i.test(email);
  if (!email || !isValid) {
    return { ok: false, email: null };
  }
  return { ok: true, email };
}

function normalizeAndValidateTeacherSalutation(raw) {
  const salutation = typeof raw === 'string' ? raw.trim() : '';
  const allowed = new Set(['Herr', 'Frau', 'Divers']);
  if (!salutation || !allowed.has(salutation)) {
    return { ok: false, salutation: null };
  }
  return { ok: true, salutation };
}

async function verifyBookingRequestToken(token) {
  if (!token || typeof token !== 'string') {
    const err = new Error('Ungültiger oder abgelaufener Link');
    err.statusCode = 404;
    throw err;
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows } = await query(
    `SELECT * FROM booking_requests WHERE status = 'requested' AND verification_token_hash = $1`,
    [tokenHash]
  );
  const reqRow = rows[0] || null;

  if (!reqRow) {
    const err = new Error('Ungültiger oder abgelaufener Link');
    err.statusCode = 404;
    throw err;
  }

  // Idempotent verify
  if (reqRow.verified_at) {
    return { requestRow: reqRow, verifiedAt: reqRow.verified_at };
  }

  const ttlHoursRaw = process.env.VERIFICATION_TOKEN_TTL_HOURS;
  const ttlHours = Number.parseInt(ttlHoursRaw || '72', 10);
  const ttlMs = (Number.isFinite(ttlHours) ? ttlHours : 72) * 60 * 60 * 1000;

  if (reqRow.verification_sent_at) {
    const sentAt = new Date(reqRow.verification_sent_at);
    if (!Number.isNaN(sentAt.getTime())) {
      const ageMs = Date.now() - sentAt.getTime();
      if (ageMs > ttlMs) {
        const err = new Error('Link abgelaufen. Bitte senden Sie Ihre Anfrage erneut.');
        err.statusCode = 410;
        throw err;
      }
    }
  }

  const now = new Date().toISOString();
  await query(
    `UPDATE booking_requests SET verified_at = $1, verification_token_hash = NULL, updated_at = $1 WHERE id = $2`,
    [now, reqRow.id]
  );

  return {
    requestRow: { ...reqRow, verified_at: now, verification_token_hash: null },
    verifiedAt: now,
  };
}

// Express App
const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  process.env.FRONTEND_URL // Vercel URL
].filter(Boolean);

// Flexible CORS: allow configured origins and safe hosted domains
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    try {
      const o = new URL(origin);
      const host = o.hostname;
      const isAllowedList = allowedOrigins.includes(origin);
      const isLocalhost = host === 'localhost' || host.startsWith('127.');
      const isVercel = host.endsWith('.vercel.app');
      const isRender = host.endsWith('.onrender.com');
      const isIONOS = host.endsWith('.app-ionos.space') || host.endsWith('.eduvite.de') || host === 'eduvite.de';
      if (isAllowedList || isLocalhost || isVercel || isRender || isIONOS) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    } catch {
      return callback(new Error('Invalid origin'));
    }
  }
}));
app.use(express.json());

// Simple request logging (can be replaced by morgan later)
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Auth Routes
app.use('/api/auth', authRoutes);
app.use('/api/teacher', teacherRoutes);

// Public Routes
// Dev helper: fetch last email preview URL (Ethereal)
app.get('/api/dev/email/last', (req, res) => {
  const transport = (process.env.MAIL_TRANSPORT || '').trim().toLowerCase();
  const allow = transport === 'ethereal' && process.env.NODE_ENV !== 'production';
  if (!allow) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.json({ email: getLastEmailDebugInfo() });
});

// GET /api/teachers
app.get('/api/teachers', async (_req, res) => {
  try {
    const teachers = await listTeachers();
    res.json({ teachers });
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// GET /api/admin/feedback - List anonymous teacher feedback (admin only)
app.get('/api/admin/feedback', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query('SELECT id, message, created_at FROM feedback ORDER BY created_at DESC LIMIT 200');

    return res.json({ feedback: rows });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// DELETE /api/admin/feedback/:id - Delete a single feedback entry (admin only)
app.delete('/api/admin/feedback/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid feedback id' });
  }

  try {
    const { rows } = await query('DELETE FROM feedback WHERE id = $1 RETURNING id', [id]);

    const deleted = rows.length;
    if (!deleted) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

// GET /api/slots?teacherId=1
app.get('/api/slots', async (req, res) => {
  try {
    const { teacherId, eventId } = req.query;
    if (!teacherId) {
      return res.status(400).json({ error: 'teacherId query param required' });
    }
    const teacherIdNum = parseInt(teacherId, 10);
    if (isNaN(teacherIdNum)) {
      return res.status(400).json({ error: 'teacherId must be a number' });
    }

    const { rows: teacherRows } = await query('SELECT id, system FROM teachers WHERE id = $1', [teacherIdNum]);
    const teacherRow = teacherRows[0] || null;
    if (!teacherRow) throw new Error('Teacher not found');

    // Resolve event scope: explicit eventId OR active published event
    let resolvedEventId = null;
    let resolvedEventStartsAt = null;
    if (eventId !== undefined) {
      const parsed = parseInt(String(eventId), 10);
      if (isNaN(parsed)) {
        return res.status(400).json({ error: 'eventId must be a number' });
      }
      resolvedEventId = parsed;
      try {
        const { rows: evRows } = await query('SELECT id, starts_at FROM events WHERE id = $1', [resolvedEventId]);
        const ev = evRows[0] || null;
        resolvedEventStartsAt = ev?.starts_at || null;
      } catch {
        resolvedEventStartsAt = null;
      }
    } else {
      const now = new Date().toISOString();
      const { rows: activeRows } = await query(
        `SELECT id, starts_at FROM events WHERE status = 'published' AND (booking_opens_at IS NULL OR booking_opens_at <= $1) AND (booking_closes_at IS NULL OR booking_closes_at >= $1) ORDER BY starts_at DESC LIMIT 1`,
        [now]
      );
      resolvedEventId = activeRows.length ? activeRows[0].id : null;
      resolvedEventStartsAt = activeRows.length ? activeRows[0].starts_at : null;
    }

    const teacherSystem = teacherRow?.system || 'dual';
    const times = getRequestedTimeWindowsForSystem(teacherSystem);
    const eventDate = formatDateDE(resolvedEventStartsAt || new Date().toISOString()) || '01.01.1970';

    // Privacy: do not expose booking occupancy or visitor details on public endpoints.
    // Return synthetic slot-like objects (id is stable per response but not a DB slot id).
    const publicSlots = times.map((time, idx) => ({
      id: idx + 1,
      eventId: resolvedEventId ?? undefined,
      teacherId: teacherIdNum,
      time,
      date: eventDate,
      booked: false,
    }));

    return res.json({ slots: publicSlots });
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// POST /api/bookings
// Body: { slotId, visitorType, parentName, companyName, studentName, traineeName, className, email, message }
app.post('/api/bookings', async (req, res) => {
  try {
    const payload = req.body || {};

    // Require active published event before accepting booking requests
    const nowIso = new Date().toISOString();
    const { rows: activeEventRows } = await query(
      `SELECT id FROM events WHERE status = 'published' AND (booking_opens_at IS NULL OR booking_opens_at <= $1) AND (booking_closes_at IS NULL OR booking_closes_at >= $1) ORDER BY starts_at DESC LIMIT 1`,
      [nowIso]
    );
    const activeEventId = activeEventRows.length ? activeEventRows[0].id : null;
    if (!activeEventId) {
      return res.status(409).json({ error: 'Buchungen sind aktuell nicht freigegeben' });
    }

    const { slotRow, verificationToken } = await reserveBooking(payload);

    // If the slot is linked to an event, enforce it matches active event
    if (slotRow?.event_id && slotRow.event_id !== activeEventId) {
      return res.status(409).json({ error: 'Dieser Termin gehört nicht zum aktuell freigegebenen Elternsprechtag' });
    }

    // Send verification email (best-effort)
    if (slotRow && isEmailConfigured()) {
      const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
      const verifyUrl = `${baseUrl}/verify?token=${verificationToken}`;
      const { rows: teacherLookupRows } = await query('SELECT * FROM teachers WHERE id = $1', [slotRow.teacher_id]);
      const teacher = teacherLookupRows[0] || {};
      const subject = `BKSB Elternsprechtag – E-Mail-Adresse bestätigen (Terminreservierung)`;
      const plain = `Guten Tag,

    bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihre Terminreservierung im BKSB-Elternsprechtag-System abzuschließen.

    Termin: ${slotRow.date} ${slotRow.time}
    Lehrkraft: ${teacher.name || '—'}
    Raum: ${teacher.room || '—'}

    Bestätigungslink: ${verifyUrl}

    Hinweis: Erst nach erfolgreicher Bestätigung kann die Lehrkraft Ihren Termin verbindlich bestätigen.

    Mit freundlichen Grüßen

    Ihr BKSB-Team`;
      const html = `<p>Guten Tag,</p>
    <p>bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihre Terminreservierung im BKSB-Elternsprechtag-System abzuschließen.</p>
    <p><strong>Termin:</strong> ${slotRow.date} ${slotRow.time}<br/>
    <strong>Lehrkraft:</strong> ${teacher.name || '—'}<br/>
    <strong>Raum:</strong> ${teacher.room || '—'}</p>
    <p><a href="${verifyUrl}">E-Mail-Adresse jetzt bestätigen</a></p>
    <p><strong>Hinweis:</strong> Erst nach erfolgreicher Bestätigung kann die Lehrkraft Ihren Termin verbindlich bestätigen.</p>
    <p>Mit freundlichen Grüßen</p>
    <p>Ihr BKSB-Team</p>`;
      try {
        await sendMail({ to: payload.email, subject, text: plain, html });
      } catch (e) {
        console.warn('Sending verification email failed:', e?.message || e);
      }
    }

    res.json({ success: true, updatedSlot: mapSlotRow(slotRow) });
  } catch (error) {
    console.error('Error creating booking:', error);
    const status = error?.statusCode || 500;
    res.status(status).json({ error: error?.message || 'Failed to create booking' });
  }
});

// POST /api/booking-requests
// Body: { teacherId, requestedTime, visitorType, parentName, companyName, studentName, traineeName, representativeName, className, email, message }
app.post('/api/booking-requests', async (req, res) => {
  try {
    const payload = req.body || {};

    // Require active published event
    const nowIso = new Date().toISOString();
    const { rows: activeEventRows } = await query(
      `SELECT id, starts_at FROM events WHERE status = 'published' AND (booking_opens_at IS NULL OR booking_opens_at <= $1) AND (booking_closes_at IS NULL OR booking_closes_at >= $1) ORDER BY starts_at DESC LIMIT 1`,
      [nowIso]
    );
    const activeEvent = activeEventRows.length ? activeEventRows[0] : null;
    const activeEventId = activeEvent?.id || null;
    if (!activeEventId) {
      return res.status(409).json({ error: 'Buchungen sind aktuell nicht freigegeben' });
    }

    const teacherIdNum = parseInt(String(payload.teacherId || ''), 10);
    if (!teacherIdNum || isNaN(teacherIdNum)) {
      return res.status(400).json({ error: 'teacherId required' });
    }

    const { rows: teacherLookupRows2 } = await query('SELECT id, system FROM teachers WHERE id = $1', [teacherIdNum]);
    const teacherRow = teacherLookupRows2[0] || null;
    if (!teacherRow) throw new Error('Teacher not found');

    const requestedTime = typeof payload.requestedTime === 'string' ? payload.requestedTime.trim() : '';
    const allowedTimes = getRequestedTimeWindowsForSystem(teacherRow?.system || 'dual');
    if (!allowedTimes.includes(requestedTime)) {
      return res.status(400).json({ error: 'requestedTime invalid' });
    }

    const visitorType = payload.visitorType;
    const className = typeof payload.className === 'string' ? payload.className.trim() : '';
    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';

    if (!visitorType || !className || !email) {
      return res.status(400).json({ error: 'visitorType, className, email required' });
    }

    const normalize = (v) => (typeof v === 'string' ? v.trim() : '');

    if (visitorType === 'parent') {
      const parentName = normalize(payload.parentName);
      const studentName = normalize(payload.studentName);
      if (!parentName || !studentName) {
        return res.status(400).json({ error: 'parentName and studentName required for parent type' });
      }
    } else if (visitorType === 'company') {
      const companyName = normalize(payload.companyName);
      const traineeName = normalize(payload.traineeName);
      const representativeName = normalize(payload.representativeName);
      if (!companyName || !traineeName || !representativeName) {
        return res.status(400).json({ error: 'companyName, traineeName and representativeName required for company type' });
      }
    } else {
      return res.status(400).json({ error: 'visitorType must be parent or company' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const now = new Date().toISOString();
    const eventDate = formatDateDE(activeEvent.starts_at) || formatDateDE(now) || '01.01.1970';

    const insert = {
      event_id: activeEventId,
      teacher_id: teacherIdNum,
      requested_time: requestedTime,
      date: eventDate,
      status: 'requested',
      visitor_type: visitorType,
      class_name: className,
      email,
      message: message || null,
      verification_token_hash: verificationTokenHash,
      verification_sent_at: now,
      verified_at: null,
      confirmation_sent_at: null,
      assigned_slot_id: null,
      updated_at: now,
    };

    if (visitorType === 'parent') {
      insert.parent_name = normalize(payload.parentName);
      insert.student_name = normalize(payload.studentName);
      insert.company_name = null;
      insert.trainee_name = null;
      insert.representative_name = null;
    } else {
      insert.company_name = normalize(payload.companyName);
      insert.trainee_name = normalize(payload.traineeName);
      insert.representative_name = normalize(payload.representativeName);
      insert.parent_name = null;
      insert.student_name = null;
    }

    const insertKeys = Object.keys(insert);
    const insertValues = Object.values(insert);
    const insertPlaceholders = insertKeys.map((_, i) => `$${i + 1}`).join(', ');
    const insertColumns = insertKeys.join(', ');
    const { rows: createdRows } = await query(
      `INSERT INTO booking_requests (${insertColumns}) VALUES (${insertPlaceholders}) RETURNING *`,
      insertValues
    );
    const created = createdRows[0] || null;

    // Send verification email (best-effort)
    if (created && isEmailConfigured()) {
      const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
      const verifyUrl = `${baseUrl}/verify?token=${verificationToken}`;
      const { rows: teacherEmailRows } = await query('SELECT * FROM teachers WHERE id = $1', [teacherIdNum]);
      const teacher = teacherEmailRows[0] || {};
      const subject = `BKSB Elternsprechtag – E-Mail-Adresse bestätigen (Terminanfrage)`;
      const plain = `Guten Tag,

bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihre Terminanfrage im BKSB-Elternsprechtag-System abzuschließen.

Gewünschter Zeitraum: ${created.date} ${created.requested_time}
Lehrkraft: ${teacher.name || '—'}
Raum: ${teacher.room || '—'}

Bestätigungslink: ${verifyUrl}

Hinweis: Die Lehrkraft vergibt die Termine. Nach Bestätigung Ihrer E-Mail-Adresse kann die Lehrkraft die Anfrage annehmen.

Mit freundlichen Grüßen

Ihr BKSB-Team`;
      const html = `<p>Guten Tag,</p>
<p>bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihre Terminanfrage im BKSB-Elternsprechtag-System abzuschließen.</p>
<p><strong>Gewünschter Zeitraum:</strong> ${created.date} ${created.requested_time}<br/>
<strong>Lehrkraft:</strong> ${teacher.name || '—'}<br/>
<strong>Raum:</strong> ${teacher.room || '—'}</p>
<p><a href="${verifyUrl}">E-Mail-Adresse jetzt bestätigen</a></p>
<p><strong>Hinweis:</strong> Die Lehrkraft vergibt die Termine. Nach Bestätigung Ihrer E-Mail-Adresse kann die Lehrkraft die Anfrage annehmen.</p>
<p>Mit freundlichen Grüßen</p>
<p>Ihr BKSB-Team</p>`;
      try {
        await sendMail({ to: email, subject, text: plain, html });
      } catch (e) {
        console.warn('Sending verification email (request) failed:', e?.message || e);
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error creating booking request:', error);
    return res.status(500).json({ error: 'Failed to create booking request' });
  }
});

// GET /api/bookings/verify/:token - verify email and possibly send confirmation if already accepted
app.get('/api/bookings/verify/:token', async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  try {
    let slot = null;
    let request = null;
    let now = new Date().toISOString();

    try {
      const verifiedSlot = await verifyBookingToken(token);
      slot = verifiedSlot.slotRow;
      now = verifiedSlot.verifiedAt;
    } catch (e) {
      if (e?.statusCode !== 404) throw e;
      const verifiedReq = await verifyBookingRequestToken(token);
      request = verifiedReq.requestRow;
      now = verifiedReq.verifiedAt;
    }

    // Legacy slot verification path
    if (slot) {
      if (slot.status === 'confirmed' && !slot.confirmation_sent_at && isEmailConfigured()) {
        try {
          const { rows: tRows } = await query('SELECT * FROM teachers WHERE id = $1', [slot.teacher_id]);
          const teacher = tRows[0] || {};
          const subject = `BKSB Elternsprechtag – Termin bestätigt am ${slot.date} (${slot.time})`;
          const plain = `Guten Tag,

Ihre Terminbuchung wurde durch die Lehrkraft bestätigt.

Termin: ${slot.date} ${slot.time}
Lehrkraft: ${teacher.name || '—'}
Raum: ${teacher.room || '—'}

Mit freundlichen Grüßen

Ihr BKSB-Team`;
          const html = `<p>Guten Tag,</p>
<p>Ihre Terminbuchung wurde durch die Lehrkraft bestätigt.</p>
<p><strong>Termin:</strong> ${slot.date} ${slot.time}<br/>
<strong>Lehrkraft:</strong> ${teacher.name || '—'}<br/>
<strong>Raum:</strong> ${teacher.room || '—'}</p>
<p>Mit freundlichen Grüßen</p>
<p>Ihr BKSB-Team</p>`;
          await sendMail({ to: slot.email, subject, text: plain, html });
          await query('UPDATE slots SET confirmation_sent_at = $1, updated_at = $1 WHERE id = $2', [now, slot.id]);
        } catch (e) {
          console.warn('Sending confirmation after verify failed:', e?.message || e);
        }
      }
      return res.json({ success: true, message: 'E-Mail bestätigt. Wir informieren Sie bei Bestätigung durch die Lehrkraft.' });
    }

    // Booking request verification path
    if (request) {
      // If already accepted and slot assigned, and confirmation not sent, send now
      if (request.status === 'accepted' && request.assigned_slot_id && !request.confirmation_sent_at && isEmailConfigured()) {
        try {
          const { rows: slotLookupRows } = await query('SELECT * FROM slots WHERE id = $1', [request.assigned_slot_id]);
          const slotRow = slotLookupRows[0] || null;
          const { rows: tRows2 } = await query('SELECT * FROM teachers WHERE id = $1', [request.teacher_id]);
          const teacher = tRows2[0] || {};
          const when = slotRow ? `${slotRow.date} ${slotRow.time}` : `${request.date} ${request.requested_time}`;
          const subject = `BKSB Elternsprechtag – Termin bestätigt (${when})`;
          const plain = `Guten Tag,

Ihre Terminanfrage wurde durch die Lehrkraft angenommen.

Termin: ${when}
Lehrkraft: ${teacher.name || '—'}
Raum: ${teacher.room || '—'}

Mit freundlichen Grüßen

Ihr BKSB-Team`;
          const html = `<p>Guten Tag,</p>
<p>Ihre Terminanfrage wurde durch die Lehrkraft angenommen.</p>
<p><strong>Termin:</strong> ${when}<br/>
<strong>Lehrkraft:</strong> ${teacher.name || '—'}<br/>
<strong>Raum:</strong> ${teacher.room || '—'}</p>
<p>Mit freundlichen Grüßen</p>
<p>Ihr BKSB-Team</p>`;
          await sendMail({ to: request.email, subject, text: plain, html });
          await query('UPDATE booking_requests SET confirmation_sent_at = $1, updated_at = $1 WHERE id = $2', [now, request.id]);
        } catch (e) {
          console.warn('Sending confirmation after request verify failed:', e?.message || e);
        }
      }
      return res.json({ success: true, message: 'E-Mail bestätigt. Wir informieren Sie, sobald die Lehrkraft Ihnen einen Termin zuweist.' });
    }

    return res.json({ success: true, message: 'E-Mail bestätigt.' });
  } catch (e) {
    console.error('Error verifying email:', e);
    const status = e?.statusCode || 500;
    return res.status(status).json({ error: e?.message || 'Verifikation fehlgeschlagen' });
  }
});

// Admin Routes (Protected)
// GET /api/admin/bookings - Get all bookings with teacher info
app.get('/api/admin/bookings', requireAdmin, async (_req, res) => {
  try {
    const bookings = await listAdminBookings();
    res.json({ bookings });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// DELETE /api/admin/bookings/:slotId - Cancel a booking
app.delete('/api/admin/bookings/:slotId', requireAdmin, async (req, res) => {
  const slotId = parseInt(req.params.slotId, 10);
  
  if (isNaN(slotId)) {
    return res.status(400).json({ error: 'Invalid slotId' });
  }

  // Clear booking data
  try {
    const { previous } = await cancelBookingAdmin(slotId);

    // Best-effort cancellation email (only if the booking email was verified)
    if (previous && previous.email && previous.verified_at && isEmailConfigured()) {
      try {
        const { rows: tRows3 } = await query('SELECT * FROM teachers WHERE id = $1', [previous.teacher_id]);
        const teacher = tRows3[0] || {};

        const subject = `BKSB Elternsprechtag – Termin storniert am ${previous.date} (${previous.time})`;
        const plain = `Guten Tag,

      wir bestätigen Ihnen die Stornierung Ihres Termins.

      Termin: ${previous.date} ${previous.time}
      Lehrkraft: ${teacher.name || '—'}
      Raum: ${teacher.room || '—'}

      Wenn Sie einen neuen Termin vereinbaren möchten, können Sie dies jederzeit über das Buchungssystem tun.

      Mit freundlichen Grüßen

      Ihr BKSB-Team`;
        const html = `<p>Guten Tag,</p>
      <p>wir bestätigen Ihnen die Stornierung Ihres Termins.</p>
      <p><strong>Termin:</strong> ${previous.date} ${previous.time}<br/>
      <strong>Lehrkraft:</strong> ${teacher.name || '—'}<br/>
      <strong>Raum:</strong> ${teacher.room || '—'}</p>
      <p>Wenn Sie einen neuen Termin vereinbaren möchten, können Sie dies jederzeit über das Buchungssystem tun.</p>
      <p>Mit freundlichen Grüßen</p>
      <p>Ihr BKSB-Team</p>`;

        await sendMail({ to: previous.email, subject, text: plain, html });
        await query('UPDATE slots SET cancellation_sent_at = $1 WHERE id = $2', [new Date().toISOString(), slotId]);
      } catch (e) {
        console.warn('Sending cancellation email (admin) failed:', e?.message || e);
      }
    }

    res.json({ 
      success: true, 
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    const status = error?.statusCode || 500;
    res.status(status).json({ error: error?.message || 'Failed to cancel booking' });
  }
});

// GET /api/admin/users - List login users (admin only)
app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query('SELECT id, username, role, teacher_id, created_at, updated_at FROM users ORDER BY id');

    return res.json({ users: rows });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:id - Update user role (admin only)
app.patch('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const { role } = req.body || {};
  const roleStr = String(role || '').trim();
  if (roleStr !== 'admin' && roleStr !== 'teacher') {
    return res.status(400).json({ error: 'role must be "admin" or "teacher"' });
  }

  // Best-effort safety: prevent an admin from demoting themselves.
  try {
    if (req.user?.username) {
      const { rows: meRows } = await query('SELECT id, role FROM users WHERE username = $1 LIMIT 1', [req.user.username]);
      const me = meRows[0] || null;
      if (me && Number(me.id) === userId && roleStr !== 'admin') {
        return res.status(400).json({ error: 'You cannot remove your own admin role.' });
      }
    }
  } catch {
    // ignore safety check failures
  }

  try {
    const { rows: updatedUserRows } = await query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role, teacher_id, created_at, updated_at',
      [roleStr, userId]
    );
    const data = updatedUserRows[0] || null;

    if (!data) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ success: true, user: data });
  } catch (error) {
    console.error('Error updating admin user role:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// Helper function to generate time slots
function generateTimeSlots(system, slotMinutes = 15) {
  if (system === 'vollzeit') {
    return buildQuarterHourWindows(17, 19, slotMinutes);
  }
  return buildQuarterHourWindows(16, 18, slotMinutes);
}

// POST /api/admin/teachers - Create new teacher (and login user)
app.post('/api/admin/teachers', requireAdmin, async (req, res) => {
  try {
    const { name, email, salutation, subject, system, room, username: reqUsername, password: reqPassword } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'name required' });
    }

    const parsedEmail = normalizeAndValidateTeacherEmail(email);
    if (!parsedEmail.ok) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse. Sie muss auf @bksb.nrw enden.' });
    }

    const parsedSalutation = normalizeAndValidateTeacherSalutation(salutation);
    if (!parsedSalutation.ok) {
      return res.status(400).json({ error: 'Ungültige Anrede. Erlaubt: Herr, Frau, Divers.' });
    }

    const teacherSystem = system || 'dual'; // Fallback to dual if not provided

    if (teacherSystem !== 'dual' && teacherSystem !== 'vollzeit') {
      return res.status(400).json({ error: 'system must be "dual" or "vollzeit"' });
    }

    // Create teacher
    const { rows: newTeacherRows } = await query(
      'INSERT INTO teachers (name, email, salutation, subject, system, room) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name.trim(), parsedEmail.email, parsedSalutation.salutation, subject || 'Sprechstunde', teacherSystem, room ? room.trim() : null]
    );
    const teacher = newTeacherRows[0];

    // Generate time slots based on system
    const timeSlots = generateTimeSlots(teacherSystem);

    // Prefer: create slots for the currently active (published) event.
    // Fallback: newest event (any status). Last resort: settings.event_date.
    const formatDateDE = (isoOrDate) => {
      const d = new Date(isoOrDate);
      if (Number.isNaN(d.getTime())) return null;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = String(d.getFullYear());
      return `${dd}.${mm}.${yyyy}`;
    };

    let targetEventId = null;
    let eventDate = null;

    try {
      const nowIso = new Date().toISOString();
      const { rows: activeEvRows } = await query(
        `SELECT id, starts_at FROM events WHERE status = 'published' AND (booking_opens_at IS NULL OR booking_opens_at <= $1) AND (booking_closes_at IS NULL OR booking_closes_at >= $1) ORDER BY starts_at DESC LIMIT 1`,
        [nowIso]
      );
      const activeEvent = activeEvRows.length ? activeEvRows[0] : null;
      if (activeEvent?.id) {
        targetEventId = activeEvent.id;
        eventDate = formatDateDE(activeEvent.starts_at);
      }
    } catch (e) {
      console.warn('Resolving active event for teacher slots failed:', e?.message || e);
    }

    if (!targetEventId || !eventDate) {
      try {
        const { rows: latestEvRows } = await query('SELECT id, starts_at FROM events ORDER BY starts_at DESC LIMIT 1');
        const latest = latestEvRows.length ? latestEvRows[0] : null;
        if (latest?.id) {
          targetEventId = latest.id;
          eventDate = formatDateDE(latest.starts_at);
        }
      } catch (e) {
        console.warn('Resolving latest event for teacher slots failed:', e?.message || e);
      }
    }

    if (!eventDate) {
      // Settings fallback: stored as DATE (YYYY-MM-DD)
      try {
        const { rows: settingsRows } = await query('SELECT event_date FROM settings LIMIT 1');
        if (settingsRows[0]?.event_date) {
          eventDate = formatDateDE(settingsRows[0].event_date);
        }
      } catch {}
    }

    if (!eventDate) {
      eventDate = formatDateDE(new Date().toISOString()) || '01.01.1970';
    }

    const now = new Date().toISOString();
    const slotsToInsert = timeSlots.map(time => ({
      teacher_id: teacher.id,
      event_id: targetEventId,
      time: time,
      date: eventDate,
      booked: false,
      updated_at: now,
    }));

    if (slotsToInsert.length) {
      try {
        const slotCols = Object.keys(slotsToInsert[0]);
        const valueClauses = slotsToInsert.map((_, rowIdx) =>
          `(${slotCols.map((_, colIdx) => `$${rowIdx * slotCols.length + colIdx + 1}`).join(', ')})`
        ).join(', ');
        const slotValues = slotsToInsert.flatMap(s => slotCols.map(c => s[c]));
        await query(`INSERT INTO slots (${slotCols.join(', ')}) VALUES ${valueClauses}`, slotValues);
      } catch (slotsError) {
        console.error('Error creating slots:', slotsError);
        // Don't fail the teacher creation if slots fail
      }
    }

    // Create or upsert a linked user account for the teacher
    // Use provided username/password if present; otherwise generate
    const baseUsername = String(reqUsername || teacher.name || `teacher${teacher.id}`)
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 20) || `teacher${teacher.id}`;

    // Ensure uniqueness by appending id if needed
    const username = `${baseUsername}${baseUsername.endsWith(String(teacher.id)) ? '' : teacher.id}`;
    const providedPw = reqPassword && typeof reqPassword === 'string' ? reqPassword.trim() : '';
    const isStrongEnough = providedPw.length >= 8;
    const tempPassword = isStrongEnough
      ? providedPw
      : crypto.randomBytes(6).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    try {
      await query(
        `INSERT INTO users (username, password_hash, role, teacher_id) VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO UPDATE SET password_hash = $2, role = $3, teacher_id = $4`,
        [username, passwordHash, 'teacher', teacher.id]
      );
    } catch (userErr) {
      console.warn('User creation for teacher failed:', userErr?.message || userErr);
    }

    res.json({
      success: true,
      teacher,
      slotsCreated: timeSlots.length,
      slotsEventId: targetEventId,
      slotsEventDate: eventDate,
      user: { username, tempPassword }
    });
  } catch (error) {
    console.error('Error creating teacher:', error);
    res.status(500).json({ error: 'Failed to create teacher' });
  }
});

// GET /api/admin/teachers - List all teachers (admin only)
app.get('/api/admin/teachers', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM teachers ORDER BY id');
    return res.json({ teachers: rows || [] });
  } catch (error) {
    console.error('Error fetching admin teachers:', error);
    return res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// PUT /api/admin/teachers/:id - Update teacher
app.put('/api/admin/teachers/:id', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }

  try {
    const { name, email, salutation, subject, system, room } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'name required' });
    }

    const parsedEmail = normalizeAndValidateTeacherEmail(email);
    if (!parsedEmail.ok) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse. Sie muss auf @bksb.nrw enden.' });
    }

    const parsedSalutation = normalizeAndValidateTeacherSalutation(salutation);
    if (!parsedSalutation.ok) {
      return res.status(400).json({ error: 'Ungültige Anrede. Erlaubt: Herr, Frau, Divers.' });
    }

    const teacherSystem = system || 'dual'; // Fallback to dual if not provided

    if (teacherSystem !== 'dual' && teacherSystem !== 'vollzeit') {
      return res.status(400).json({ error: 'system must be "dual" or "vollzeit"' });
    }

    const { rows: updateTeacherRows } = await query(
      `UPDATE teachers SET name = $1, email = $2, salutation = $3, subject = $4, system = $5, room = $6
       WHERE id = $7 RETURNING *`,
      [name.trim(), parsedEmail.email, parsedSalutation.salutation, subject || 'Sprechstunde', teacherSystem, room ? room.trim() : null, teacherId]
    );
    
    if (updateTeacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    res.json({ success: true, teacher: updateTeacherRows[0] });
  } catch (error) {
    console.error('Error updating teacher:', error);
    res.status(500).json({ error: 'Failed to update teacher' });
  }
});

// PUT /api/admin/teachers/:id/reset-login - Regenerate teacher user's temp password
app.put('/api/admin/teachers/:id/reset-login', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }

  try {
    // Find user for this teacher
    const { rows: users } = await query(
      'SELECT * FROM users WHERE teacher_id = $1 LIMIT 1',
      [teacherId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'Kein Benutzer für diese Lehrkraft gefunden' });
    }

    const user = users[0];
    const tempPassword = crypto.randomBytes(6).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);

    res.json({ success: true, user: { username: user.username, tempPassword } });
  } catch (error) {
    console.error('Error resetting teacher login:', error);
    res.status(500).json({ error: 'Failed to reset teacher login' });
  }
});

// DELETE /api/admin/teachers/:id - Delete teacher
app.delete('/api/admin/teachers/:id', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }

  try {
    // Check if teacher has any booked slots
    const { rows: bookedSlots } = await query(
      'SELECT id, booked FROM slots WHERE teacher_id = $1',
      [teacherId]
    );

    const hasBookedSlots = bookedSlots && bookedSlots.some(slot => slot.booked);
    
    if (hasBookedSlots) {
      return res.status(400).json({ 
        error: 'Lehrkraft kann nicht gelöscht werden, da noch gebuchte Termine existieren. Bitte zuerst alle gebuchten Termine stornieren.' 
      });
    }

    // Delete all available (unbooked) slots first
    if (bookedSlots && bookedSlots.length > 0) {
      await query('DELETE FROM slots WHERE teacher_id = $1', [teacherId]);
    }

    // Now delete the teacher
    await query('DELETE FROM teachers WHERE id = $1', [teacherId]);

    res.json({ 
      success: true, 
      message: 'Teacher deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting teacher:', error);
    res.status(500).json({ error: 'Failed to delete teacher' });
  }
});

// GET /api/admin/settings - Get event settings
app.get('/api/admin/settings', requireAuth, async (_req, res) => {
  try {
    const { rows: settRows } = await query('SELECT * FROM settings LIMIT 1');
    const data = settRows[0] || null;
    
    if (!data) {
        // No settings found, return default
        return res.json({
          id: 1,
          event_name: 'BKSB Elternsprechtag',
          event_date: new Date().toISOString().split('T')[0]
        });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/admin/settings - Update event settings
app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const { event_name, event_date } = req.body || {};

    if (!event_name || !event_date) {
      return res.status(400).json({ error: 'event_name and event_date required' });
    }

    // Update or insert settings
    const { rows: upsertRows } = await query(
      `INSERT INTO settings (id, event_name, event_date, updated_at) VALUES (1, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET event_name = $1, event_date = $2, updated_at = $3
       RETURNING *`,
      [event_name.trim(), event_date, new Date().toISOString()]
    );

    res.json({ success: true, settings: upsertRows[0] });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET /api/admin/slots - List slots (admin only)
// Optional query: teacherId, eventId (number | "null"), booked ("true"|"false"), limit
app.get('/api/admin/slots', requireAdmin, async (req, res) => {
  try {
    const { teacherId, eventId, booked, limit } = req.query;

    // Build dynamic query
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (teacherId !== undefined) {
      const teacherIdNum = parseInt(String(teacherId), 10);
      if (isNaN(teacherIdNum)) {
        return res.status(400).json({ error: 'teacherId must be a number' });
      }
      conditions.push(`teacher_id = $${paramIdx++}`);
      params.push(teacherIdNum);
    }

    if (eventId !== undefined) {
      const raw = String(eventId);
      if (raw === 'null') {
        conditions.push('event_id IS NULL');
      } else {
        const eventIdNum = parseInt(raw, 10);
        if (isNaN(eventIdNum)) {
          return res.status(400).json({ error: 'eventId must be a number or "null"' });
        }
        conditions.push(`event_id = $${paramIdx++}`);
        params.push(eventIdNum);
      }
    }

    if (booked !== undefined) {
      const raw = String(booked).toLowerCase();
      if (raw !== 'true' && raw !== 'false') {
        return res.status(400).json({ error: 'booked must be "true" or "false"' });
      }
      conditions.push(`booked = $${paramIdx++}`);
      params.push(raw === 'true');
    }

    const limitNum = limit !== undefined ? parseInt(String(limit), 10) : 2000;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 10000) {
      return res.status(400).json({ error: 'limit must be between 1 and 10000' });
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT * FROM slots ${whereClause} ORDER BY date, time LIMIT $${paramIdx}`,
      [...params, limitNum]
    );

    return res.json({ slots: (rows || []).map(mapSlotRow) });
  } catch (error) {
    console.error('Error fetching admin slots:', error);
    return res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// POST /api/admin/slots - Create new slot
app.post('/api/admin/slots', requireAdmin, async (req, res) => {
  try {
    const { teacher_id, time, date } = req.body || {};

    if (!teacher_id || !time || !date) {
      return res.status(400).json({ error: 'teacher_id, time, and date required' });
    }

    const { rows } = await query(
      `INSERT INTO slots (teacher_id, time, date, booked) VALUES ($1, $2, $3, false) RETURNING *`,
      [teacher_id, time.trim(), date.trim()]
    );

    res.json({ success: true, slot: rows[0] });
  } catch (error) {
    console.error('Error creating slot:', error);
    res.status(500).json({ error: 'Failed to create slot' });
  }
});

// PUT /api/admin/slots/:id - Update slot
app.put('/api/admin/slots/:id', requireAdmin, async (req, res) => {
  const slotId = parseInt(req.params.id, 10);
  
  if (isNaN(slotId)) {
    return res.status(400).json({ error: 'Invalid slot ID' });
  }

  try {
    const { time, date } = req.body || {};

    if (!time || !date) {
      return res.status(400).json({ error: 'time and date required' });
    }

    const { rows } = await query(
      `UPDATE slots SET time = $1, date = $2, updated_at = $3 WHERE id = $4 RETURNING *`,
      [time.trim(), date.trim(), new Date().toISOString(), slotId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    res.json({ success: true, slot: rows[0] });
  } catch (error) {
    console.error('Error updating slot:', error);
    res.status(500).json({ error: 'Failed to update slot' });
  }
});

// DELETE /api/admin/slots/:id - Delete slot
app.delete('/api/admin/slots/:id', requireAdmin, async (req, res) => {
  const slotId = parseInt(req.params.id, 10);
  
  if (isNaN(slotId)) {
    return res.status(400).json({ error: 'Invalid slot ID' });
  }

  try {
    await query('DELETE FROM slots WHERE id = $1', [slotId]);

    res.json({ 
      success: true, 
      message: 'Slot deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting slot:', error);
    res.status(500).json({ error: 'Failed to delete slot' });
  }
});

// POST /api/admin/teachers/:id/generate-slots
// Create all default (15-min) slots for a single teacher for the active (published) event.
// Falls back to latest event, then settings.event_date, then today.
app.post('/api/admin/teachers/:id/generate-slots', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }

  const formatDateDE = (isoOrDate) => {
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}.${mm}.${yyyy}`;
  };

  try {
    const { rows: teacherRows } = await query(
      'SELECT id, system FROM teachers WHERE id = $1',
      [teacherId]
    );
    const teacherRow = teacherRows[0];
    if (!teacherRow) return res.status(404).json({ error: 'Teacher not found' });

    const nowIso = new Date().toISOString();
    let targetEventId = null;
    let eventDate = null;

    try {
      const { rows: activeEvents } = await query(
        `SELECT id, starts_at FROM events
         WHERE status = 'published'
           AND (booking_opens_at IS NULL OR booking_opens_at <= $1)
           AND (booking_closes_at IS NULL OR booking_closes_at >= $1)
         ORDER BY starts_at DESC LIMIT 1`,
        [nowIso]
      );
      const activeEvent = activeEvents && activeEvents.length ? activeEvents[0] : null;
      if (activeEvent?.id) {
        targetEventId = activeEvent.id;
        eventDate = formatDateDE(activeEvent.starts_at);
      }
    } catch (e) {
      console.warn('Resolving active event for teacher slot generation failed:', e?.message || e);
    }

    if (!targetEventId || !eventDate) {
      try {
        const { rows: latestEvents } = await query(
          'SELECT id, starts_at FROM events ORDER BY starts_at DESC LIMIT 1'
        );
        const latest = latestEvents && latestEvents.length ? latestEvents[0] : null;
        if (latest?.id) {
          targetEventId = latest.id;
          eventDate = formatDateDE(latest.starts_at);
        }
      } catch (e) {
        console.warn('Resolving latest event for teacher slot generation failed:', e?.message || e);
      }
    }

    if (!eventDate) {
      // Settings fallback: stored as DATE (YYYY-MM-DD)
      try {
        const { rows: settingsRows } = await query(
          'SELECT event_date FROM settings LIMIT 1'
        );
        const settings = settingsRows[0];
        if (settings?.event_date) {
          eventDate = formatDateDE(settings.event_date);
        }
      } catch {}
    }

    if (!eventDate) {
      eventDate = formatDateDE(new Date().toISOString()) || '01.01.1970';
    }

    const teacherSystem = teacherRow.system || 'dual';
    const times = generateTimeSlots(teacherSystem);
    const now = new Date().toISOString();

    // Fetch existing slots for this teacher for the resolved scope to avoid duplicates
    let existingConditions = 'teacher_id = $1 AND date = $2';
    let existingParams = [teacherId, eventDate];
    if (targetEventId === null) {
      existingConditions += ' AND event_id IS NULL';
    } else {
      existingConditions += ' AND event_id = $3';
      existingParams.push(targetEventId);
    }

    const { rows: existingSlots } = await query(
      `SELECT time FROM slots WHERE ${existingConditions}`,
      existingParams
    );
    const existingTimes = new Set((existingSlots || []).map((s) => s.time));

    const inserts = [];
    let skipped = 0;
    for (const time of times) {
      if (existingTimes.has(time)) {
        skipped += 1;
        continue;
      }
      inserts.push({
        teacher_id: teacherId,
        event_id: targetEventId,
        time,
        date: eventDate,
        booked: false,
        updated_at: now,
      });
    }

    if (inserts.length) {
      const values = inserts.map((ins, i) => {
        const base = i * 6;
        return `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}, $${base+6})`;
      }).join(', ');
      const flatParams = inserts.flatMap(ins => [
        ins.teacher_id, ins.event_id, ins.time, ins.date, ins.booked, ins.updated_at
      ]);
      await query(
        `INSERT INTO slots (teacher_id, event_id, time, date, booked, updated_at) VALUES ${values}`,
        flatParams
      );
    }

    return res.json({
      success: true,
      teacherId,
      eventId: targetEventId,
      eventDate,
      created: inserts.length,
      skipped,
    });
  } catch (error) {
    console.error('Error generating slots for teacher:', error);
    return res.status(500).json({ error: 'Failed to generate slots for teacher' });
  }
});

// Health / readiness route
app.get('/api/health', async (_req, res) => {
  try {
    const [teacherResult, slotResult, bookedResult] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM teachers'),
      query('SELECT COUNT(*) AS count FROM slots'),
      query('SELECT COUNT(*) AS count FROM slots WHERE booked = true')
    ]);

    res.json({ 
      status: 'ok', 
      teacherCount: parseInt(teacherResult.rows[0].count, 10) || 0, 
      slotCount: parseInt(slotResult.rows[0].count, 10) || 0,
      bookedCount: parseInt(bookedResult.rows[0].count, 10) || 0
    });
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
});

// EVENTS
// Public: get the currently active (published) event
app.get('/api/events/active', async (_req, res) => {
  try {
    const now = new Date().toISOString();
    const { rows } = await query(
      `SELECT * FROM events
       WHERE status = 'published'
         AND (booking_opens_at IS NULL OR booking_opens_at <= $1)
         AND (booking_closes_at IS NULL OR booking_closes_at >= $1)
       ORDER BY starts_at DESC LIMIT 1`,
      [now]
    );

    const activeEvent = rows && rows.length ? rows[0] : null;
    res.json({ event: activeEvent });
  } catch (error) {
    console.error('Error fetching active event:', error);
    res.status(500).json({ error: 'Failed to fetch active event' });
  }
});

// Public: get upcoming published events
app.get('/api/events/upcoming', async (_req, res) => {
  try {
    const now = new Date().toISOString();
    const { rows } = await query(
      `SELECT * FROM events
       WHERE status = 'published' AND starts_at >= $1
       ORDER BY starts_at ASC LIMIT 3`,
      [now]
    );

    res.json({ events: rows || [] });
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming events' });
  }
});

// Admin: list events
app.get('/api/admin/events', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM events ORDER BY starts_at DESC'
    );
    res.json({ events: rows || [] });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Admin: create event
app.post('/api/admin/events', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, school_year, starts_at, ends_at, timezone, booking_opens_at, booking_closes_at, status } = req.body || {};
    if (!name || !school_year || !starts_at || !ends_at) {
      return res.status(400).json({ error: 'name, school_year, starts_at, ends_at required' });
    }

    const { rows } = await query(
      `INSERT INTO events (name, school_year, starts_at, ends_at, timezone, status, booking_opens_at, booking_closes_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, school_year, starts_at, ends_at, timezone || 'Europe/Berlin', status || 'draft', booking_opens_at || null, booking_closes_at || null, new Date().toISOString()]
    );
    res.json({ success: true, event: rows[0] });
  } catch (error) {
    console.error('Error creating event:', error);
    const message = (error && typeof error === 'object' && 'message' in error)
      ? String(error.message)
      : 'Failed to create event';

    // Common case when RLS is enabled but backend uses a publishable/anon key.
    if (message.toLowerCase().includes('row-level security')) {
      return res.status(403).json({
        error: 'RLS blocked insert on events',
        message,
      });
    }

    return res.status(500).json({
      error: 'Failed to create event',
      message,
    });
  }
});

// Admin: update event (including publish/close)
app.put('/api/admin/events/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const patch = { ...(req.body || {}), updated_at: new Date().toISOString() };
    // Build dynamic SET clause
    const setCols = [];
    const setParams = [];
    let pi = 1;
    for (const [key, val] of Object.entries(patch)) {
      if (key === 'id') continue; // never update PK
      setCols.push(`${key} = $${pi++}`);
      setParams.push(val);
    }
    if (!setCols.length) return res.status(400).json({ error: 'No fields to update' });
    setParams.push(id);
    const { rows } = await query(
      `UPDATE events SET ${setCols.join(', ')} WHERE id = $${pi} RETURNING *`,
      setParams
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true, event: rows[0] });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Admin: delete event
app.delete('/api/admin/events/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await query('DELETE FROM events WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Admin: event stats (slot counts)
// GET /api/admin/events/:id/stats
app.get('/api/admin/events/:id/stats', requireAuth, requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid id' });

  try {
    // Validate event exists (keeps errors clearer)
    const { rows: eventRows } = await query(
      'SELECT id FROM events WHERE id = $1',
      [eventId]
    );
    if (!eventRows.length) return res.status(404).json({ error: 'Event not found' });

    const [
      totalRes,
      availableRes,
      bookedRes,
      reservedRes,
      confirmedRes,
    ] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM slots WHERE event_id = $1', [eventId]),
      query('SELECT COUNT(*) AS count FROM slots WHERE event_id = $1 AND booked = false', [eventId]),
      query('SELECT COUNT(*) AS count FROM slots WHERE event_id = $1 AND booked = true', [eventId]),
      query(`SELECT COUNT(*) AS count FROM slots WHERE event_id = $1 AND status = 'reserved'`, [eventId]),
      query(`SELECT COUNT(*) AS count FROM slots WHERE event_id = $1 AND status = 'confirmed'`, [eventId]),
    ]);

    res.json({
      eventId,
      totalSlots: parseInt(totalRes.rows[0].count, 10) || 0,
      availableSlots: parseInt(availableRes.rows[0].count, 10) || 0,
      bookedSlots: parseInt(bookedRes.rows[0].count, 10) || 0,
      reservedSlots: parseInt(reservedRes.rows[0].count, 10) || 0,
      confirmedSlots: parseInt(confirmedRes.rows[0].count, 10) || 0,
    });
  } catch (error) {
    console.error('Error fetching event stats:', error);
    res.status(500).json({ error: 'Failed to fetch event stats' });
  }
});

// Admin: generate slots for a specific event (single-day events)
// POST /api/admin/events/:id/generate-slots
// Body (optional): { dryRun?: boolean, replaceExisting?: boolean }
app.post('/api/admin/events/:id/generate-slots', requireAuth, requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid id' });

  const { dryRun, replaceExisting, slotMinutes: rawSlotMinutes } = req.body || {};
  const slotMinutes = [10, 15, 20, 30].includes(rawSlotMinutes) ? rawSlotMinutes : 15;

  const formatDateDE = (isoOrDate) => {
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}.${mm}.${yyyy}`;
  };

  try {
    const { rows: evtRows } = await query(
      'SELECT * FROM events WHERE id = $1',
      [eventId]
    );
    const eventRow = evtRows[0];
    if (!eventRow) return res.status(404).json({ error: 'Event not found' });

    const eventDate = formatDateDE(eventRow.starts_at);
    if (!eventDate) return res.status(400).json({ error: 'Event starts_at is invalid' });

    // Optional: replace existing slots for this event day
    if (replaceExisting) {
      if (!dryRun) {
        await query(
          'DELETE FROM slots WHERE event_id = $1 AND date = $2',
          [eventId, eventDate]
        );
      }
    }

    const { rows: teachers } = await query(
      'SELECT id, system FROM teachers'
    );

    const teacherRows = teachers || [];
    if (!teacherRows.length) return res.json({ success: true, created: 0, skipped: 0, eventDate });

    let created = 0;
    let skipped = 0;

    for (const t of teacherRows) {
      const times = generateTimeSlots(t.system || 'dual', slotMinutes);

      // Fetch existing slots for this teacher+event+date to avoid duplicates
      const { rows: existingSlots } = await query(
        'SELECT time FROM slots WHERE teacher_id = $1 AND event_id = $2 AND date = $3',
        [t.id, eventId, eventDate]
      );
      const existingTimes = new Set((existingSlots || []).map((s) => s.time));

      const inserts = [];
      for (const time of times) {
        if (existingTimes.has(time)) {
          skipped += 1;
          continue;
        }
        inserts.push({
          teacher_id: t.id,
          event_id: eventId,
          date: eventDate,
          time,
          booked: false,
          updated_at: new Date().toISOString(),
        });
      }

      if (inserts.length) {
        if (!dryRun) {
          const values = inserts.map((ins, i) => {
            const base = i * 6;
            return `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}, $${base+6})`;
          }).join(', ');
          const flatParams = inserts.flatMap(ins => [
            ins.teacher_id, ins.event_id, ins.date, ins.time, ins.booked, ins.updated_at
          ]);
          await query(
            `INSERT INTO slots (teacher_id, event_id, date, time, booked, updated_at) VALUES ${values}`,
            flatParams
          );
        }
        created += inserts.length;
      }
    }

    return res.json({ success: true, eventId, eventDate, created, skipped, dryRun: Boolean(dryRun), replaceExisting: Boolean(replaceExisting) });
  } catch (error) {
    console.error('Error generating slots for event:', error);
    return res.status(500).json({ error: 'Failed to generate slots for event' });
  }
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  const printedHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`Backend listening on http://${printedHost}:${PORT}`);
});

/*
Frontend Usage Examples (Fetch):

fetch('http://localhost:4000/api/teachers')
  .then(r => r.json())
  .then(data => console.log(data.teachers));

fetch('http://localhost:4000/api/slots?teacherId=t1')
  .then(r => r.json())
  .then(data => console.log(data.slots));

fetch('http://localhost:4000/api/bookings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    slotId: 's1',
    parentName: 'Familie Beispiel',
    studentName: 'Max Beispiel',
    className: '5a'
  })
}).then(r => r.json()).then(data => console.log(data));

To extend to DB later: replace in-memory arrays with a data access layer (e.g. services/db.js) and swap implementations without changing route handlers.
*/
