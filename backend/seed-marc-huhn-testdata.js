#!/usr/bin/env node

/**
 * Seed comprehensive test data for marc.huhn:
 *   - Booking requests with VERIFIED email addresses
 *   - Booking requests with UNVERIFIED email addresses
 *   - Confirmed bookings (directly on slots)
 *
 * Usage:
 *   node backend/seed-marc-huhn-testdata.js
 *   node backend/seed-marc-huhn-testdata.js --teacher-username marc.huhn
 *   node backend/seed-marc-huhn-testdata.js --teacher-username herrhuhn
 */

import crypto from 'crypto';
import { query } from './config/db.js';

function getArgValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function formatDateDE(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
}

function parseSlotRangeStartMinutes(range) {
  const m = String(range || '').trim().match(/^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Number.parseInt(m[1], 10) * 60 + Number.parseInt(m[2], 10);
}

function toHalfHourWindow(startMinutes) {
  if (!Number.isFinite(startMinutes)) return null;
  const windowStart = Math.floor(startMinutes / 30) * 30;
  const fmt = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  return `${fmt(windowStart)} - ${fmt(windowStart + 30)}`;
}

async function resolveTeacherIdByUsername(username) {
  const { rows } = await query(
    'SELECT teacher_id FROM users WHERE username = $1 LIMIT 1',
    [username]
  );
  if (!rows.length) throw new Error(`User "${username}" not found`);
  return rows[0]?.teacher_id ? Number(rows[0].teacher_id) : undefined;
}

async function resolveActiveEvent() {
  const nowIso = new Date().toISOString();
  const { rows } = await query(
    `SELECT id, starts_at FROM events
     WHERE status = 'published'
       AND (booking_opens_at IS NULL OR booking_opens_at <= $1)
       AND (booking_closes_at IS NULL OR booking_closes_at >= $1)
     ORDER BY starts_at DESC
     LIMIT 1`,
    [nowIso]
  );
  return rows.length ? rows[0] : null;
}

async function resolveSeedContext(teacherId) {
  const { rows: firstFreeSlots } = await query(
    `SELECT id, date, time, event_id FROM slots
     WHERE teacher_id = $1 AND booked = false
     ORDER BY date ASC, time ASC
     LIMIT 20`,
    [teacherId]
  );

  if (!firstFreeSlots.length) return { date: null, windows: [], slotEventId: null, freeSlots: [] };

  const date = firstFreeSlots[0].date;
  const sameDaySlots = firstFreeSlots.filter((s) => s.date === date);

  const windows = [];
  for (const row of sameDaySlots) {
    const startMins = parseSlotRangeStartMinutes(row.time);
    const w = toHalfHourWindow(startMins);
    if (w && !windows.includes(w)) windows.push(w);
  }

  return {
    date,
    windows,
    slotEventId: firstFreeSlots[0].event_id ?? null,
    freeSlots: sameDaySlots,
  };
}

/* ── Main ──────────────────────────────────────────────── */
async function main() {
  const username = getArgValue('--teacher-username') || 'marc.huhn';
  const teacherId = await resolveTeacherIdByUsername(username);
  if (!teacherId || Number.isNaN(teacherId)) {
    console.error(`Konnte teacher_id für Benutzer "${username}" nicht auflösen.`);
    console.error('Stelle sicher, dass der Benutzer existiert und teacher_id gesetzt ist.');
    process.exit(1);
  }

  const { rows: teacherRows } = await query(
    'SELECT id, system, name FROM teachers WHERE id = $1',
    [teacherId]
  );
  const teacher = teacherRows[0];
  if (!teacher) throw new Error(`Lehrkraft mit id=${teacherId} nicht gefunden`);

  const activeEvent = await resolveActiveEvent();
  const nowIso = new Date().toISOString();
  const ctx = await resolveSeedContext(teacherId);

  const fallbackDate = formatDateDE(activeEvent?.starts_at || nowIso) || formatDateDE(nowIso);
  const seedDate = ctx.date || fallbackDate;
  const eventId = activeEvent?.id ?? ctx.slotEventId ?? null;

  const defaultWindows = teacher.system === 'vollzeit'
    ? ['17:00 - 17:30', '17:30 - 18:00', '18:00 - 18:30', '18:30 - 19:00']
    : ['16:00 - 16:30', '16:30 - 17:00', '17:00 - 17:30', '17:30 - 18:00'];
  const requestedTimes = ctx.windows.length ? ctx.windows : defaultWindows;

  console.log(`\n🎯 Seed-Ziel: ${teacher.name} (id=${teacherId}, system=${teacher.system})`);
  console.log(`   Event:  ${eventId ?? 'keins'}`);
  console.log(`   Datum:  ${seedDate}`);
  console.log(`   Fenster: ${requestedTimes.join(', ')}\n`);

  /* ─────────────────────────────────────────────────────
   * 1) Booking Requests – VERIFIZIERTE E-Mail-Adressen
   * ───────────────────────────────────────────────────── */
  const verifiedRequests = [
    {
      visitor_type: 'parent',
      parent_name: 'Andrea Schneider',
      student_name: 'Lukas Schneider',
      class_name: 'BG 12',
      email: 'andrea.schneider@beispiel.de',
      message: 'Guten Tag, ich würde gerne über die Leistungsentwicklung meines Sohnes sprechen.',
      requested_time: requestedTimes[0] || '16:00 - 16:30',
    },
    {
      visitor_type: 'parent',
      parent_name: 'Thomas Weber',
      student_name: 'Marie Weber',
      class_name: 'WG 11',
      email: 'thomas.weber@beispiel.de',
      message: 'Fragen bezüglich der Kursauswahl für das kommende Schuljahr.',
      requested_time: requestedTimes[1] || '16:30 - 17:00',
    },
    {
      visitor_type: 'company',
      company_name: 'Bosch GmbH',
      representative_name: 'Stefan Keller',
      trainee_name: 'Anna Richter',
      class_name: 'BK 2',
      email: 'stefan.keller@bosch-beispiel.de',
      message: 'Abstimmung zum aktuellen Ausbildungsstand und geplanter Einsatz im nächsten Quartal.',
      requested_time: requestedTimes[2] || '17:00 - 17:30',
    },
  ];

  /* ─────────────────────────────────────────────────────
   * 2) Booking Requests – UNBESTÄTIGTE E-Mail-Adressen
   * ───────────────────────────────────────────────────── */
  const unverifiedRequests = [
    {
      visitor_type: 'parent',
      parent_name: 'Petra Fischer',
      student_name: 'Tim Fischer',
      class_name: 'BG 11',
      email: 'petra.fischer@beispiel.de',
      message: 'Möchte über das Sozialverhalten von Tim sprechen.',
      requested_time: requestedTimes[0] || '16:00 - 16:30',
    },
    {
      visitor_type: 'company',
      company_name: 'Sparkasse Siegen',
      representative_name: 'Claudia Braun',
      trainee_name: 'Felix Hoffmann',
      class_name: 'BK 1',
      email: 'c.braun@sparkasse-beispiel.de',
      message: 'Rückmeldung zum Berichtsheft und Zwischenprüfung.',
      requested_time: requestedTimes[1] || '16:30 - 17:00',
    },
    {
      visitor_type: 'parent',
      parent_name: 'Michael Hartmann',
      student_name: 'Sophie Hartmann',
      class_name: 'WG 12',
      email: 'michael.hartmann@beispiel.de',
      message: 'Fragen zur anstehenden Abiturprüfung.',
      requested_time: requestedTimes[2] || '17:00 - 17:30',
    },
  ];

  // Insert all booking requests
  const columns = [
    'event_id', 'teacher_id', 'requested_time', 'date', 'status',
    'visitor_type', 'parent_name', 'company_name', 'student_name',
    'trainee_name', 'representative_name', 'class_name', 'email',
    'message', 'verification_token_hash', 'verification_sent_at',
    'verified_at', 'confirmation_sent_at', 'assigned_slot_id', 'updated_at',
  ];

  function buildRow(r, verified) {
    return {
      event_id: eventId,
      teacher_id: teacherId,
      requested_time: r.requested_time,
      date: seedDate,
      status: 'requested',
      visitor_type: r.visitor_type,
      parent_name: r.parent_name || null,
      company_name: r.company_name || null,
      student_name: r.student_name || null,
      trainee_name: r.trainee_name || null,
      representative_name: r.representative_name || null,
      class_name: r.class_name,
      email: r.email,
      message: r.message,
      verification_token_hash: sha256Hex(crypto.randomBytes(32).toString('hex')),
      verification_sent_at: verified ? nowIso : nowIso,
      verified_at: verified ? nowIso : null,
      confirmation_sent_at: null,
      assigned_slot_id: null,
      updated_at: nowIso,
    };
  }

  const allRequestRows = [
    ...verifiedRequests.map((r) => buildRow(r, true)),
    ...unverifiedRequests.map((r) => buildRow(r, false)),
  ];

  const valuePlaceholders = [];
  const allVals = [];
  let paramIdx = 1;
  for (const row of allRequestRows) {
    const rowPlaceholders = columns.map((col) => {
      allVals.push(row[col] ?? null);
      return `$${paramIdx++}`;
    });
    valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
  }

  const insertSql = `INSERT INTO booking_requests (${columns.join(', ')})
    VALUES ${valuePlaceholders.join(', ')}
    RETURNING id, visitor_type, email, verified_at`;
  const { rows: created } = await query(insertSql, allVals);

  console.log('✅ Buchungsanfragen erstellt:');
  for (const r of created) {
    const tag = r.verified_at ? '✓ verifiziert' : '✗ NICHT verifiziert';
    console.log(`   #${r.id}  ${r.visitor_type.padEnd(8)} ${r.email.padEnd(38)} ${tag}`);
  }

  /* ─────────────────────────────────────────────────────
   * 3) Bestätigte Buchungen (direkt auf Slots)
   * ───────────────────────────────────────────────────── */
  const confirmedBookings = [
    {
      visitor_type: 'parent',
      parent_name: 'Julia Müller',
      student_name: 'Nico Müller',
      class_name: 'WG 11',
      email: 'julia.mueller@beispiel.de',
      message: 'Fortschritt in Mathematik besprechen.',
    },
    {
      visitor_type: 'company',
      company_name: 'Daimler Truck AG',
      representative_name: 'Hans Berger',
      trainee_name: 'Lisa Bauer',
      class_name: 'BK 3',
      email: 'hans.berger@daimler-beispiel.de',
      message: 'Halbjahresgespräch zum Ausbildungsstand.',
    },
    {
      visitor_type: 'parent',
      parent_name: 'Sabine Klein',
      student_name: 'Emilia Klein',
      class_name: 'BG 12',
      email: 'sabine.klein@beispiel.de',
      message: 'Rückfragen zum Praktikumsbericht und anstehenden Klausuren.',
    },
  ];

  // Find free slots for confirmed bookings
  const { rows: freeSlots } = await query(
    `SELECT id, date, time FROM slots
     WHERE teacher_id = $1 AND booked = false
     ORDER BY date ASC, time ASC
     LIMIT $2`,
    [teacherId, confirmedBookings.length]
  );

  const bookedSlotIds = [];

  for (let i = 0; i < confirmedBookings.length; i++) {
    const booking = confirmedBookings[i];
    let slotId;
    let slotDate;
    let slotTime;

    if (freeSlots[i]) {
      slotId = freeSlots[i].id;
      slotDate = freeSlots[i].date;
      slotTime = freeSlots[i].time;
    } else {
      // No free slot available – create one
      slotDate = seedDate;
      const hour = 16 + i;
      slotTime = `${String(hour).padStart(2, '0')}:00 - ${String(hour).padStart(2, '0')}:15`;
      const { rows: inserted } = await query(
        `INSERT INTO slots (teacher_id, date, time, booked, event_id, updated_at)
         VALUES ($1, $2, $3, false, $4, $5)
         RETURNING id`,
        [teacherId, slotDate, slotTime, eventId, nowIso]
      );
      slotId = inserted[0]?.id;
    }

    // Build update fields
    const updateFields = {
      booked: true,
      status: 'confirmed',
      visitor_type: booking.visitor_type,
      email: booking.email,
      message: booking.message,
      class_name: booking.class_name,
      verified_at: nowIso,
      updated_at: nowIso,
    };
    if (booking.visitor_type === 'parent') {
      updateFields.parent_name = booking.parent_name;
      updateFields.student_name = booking.student_name;
    } else {
      updateFields.company_name = booking.company_name;
      updateFields.representative_name = booking.representative_name;
      updateFields.trainee_name = booking.trainee_name;
    }

    const cols = Object.keys(updateFields);
    const vals = Object.values(updateFields);
    const setClause = cols.map((c, idx) => `${c} = $${idx + 1}`).join(', ');
    vals.push(slotId);
    await query(`UPDATE slots SET ${setClause} WHERE id = $${vals.length}`, vals);

    bookedSlotIds.push({ slotId, slotDate, slotTime, type: booking.visitor_type, email: booking.email });
  }

  console.log('\n✅ Bestätigte Buchungen erstellt:');
  for (const b of bookedSlotIds) {
    console.log(`   Slot #${b.slotId}  ${b.slotDate} ${b.slotTime}  ${b.type.padEnd(8)} ${b.email}`);
  }

  console.log(`\n🏁 Fertig! Testdaten für ${teacher.name}:`);
  console.log(`   ${verifiedRequests.length} Anfragen mit bestätigter E-Mail`);
  console.log(`   ${unverifiedRequests.length} Anfragen mit unbestätigter E-Mail`);
  console.log(`   ${bookedSlotIds.length} bestätigte Buchungen`);
  console.log('\nSichtbar unter:');
  console.log('  → Lehrkraft-Dashboard: bestätigte Buchungen');
  console.log('  → Anfragen einsehen: Buchungsanfragen (verifiziert + unverifiziert)');
}

main().catch((e) => {
  console.error('Fehler beim Seeden der Testdaten:', e?.message || e);
  process.exit(1);
});
