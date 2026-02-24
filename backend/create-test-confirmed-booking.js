#!/usr/bin/env node

import { query } from './config/db.js';

function getArgValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function formatDateDE(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return undefined;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

async function resolveTeacherId() {
  const byId = getArgValue('--teacher-id');
  if (byId) return Number(byId);

  const username = getArgValue('--teacher-username');
  if (!username) return undefined;

  const { rows } = await query(
    'SELECT teacher_id FROM users WHERE username = $1 LIMIT 1',
    [username]
  );
  return rows[0]?.teacher_id ? Number(rows[0].teacher_id) : undefined;
}

async function resolveEventDateDE() {
  try {
    const { rows } = await query('SELECT event_date FROM settings LIMIT 1');
    if (rows[0]?.event_date) {
      const de = formatDateDE(rows[0].event_date);
      if (de) return de;
    }
  } catch {
    // ignore
  }
  return formatDateDE(new Date());
}

async function main() {
  const teacherId = await resolveTeacherId();
  if (!teacherId || Number.isNaN(teacherId)) {
    console.error('Missing teacher id. Use --teacher-id <id> or --teacher-username <username>.');
    process.exit(1);
  }

  const visitorType = (getArgValue('--visitor-type') || 'company').toLowerCase();
  const nowIso = new Date().toISOString();

  // Prefer updating an existing unbooked slot to avoid duplicate times.
  const { rows: candidateSlots } = await query(
    'SELECT id, date, time, booked FROM slots WHERE teacher_id = $1 AND booked = false ORDER BY date, time LIMIT 1',
    [teacherId]
  );

  let slotId;
  let slotDate;
  let slotTime;

  if (candidateSlots && candidateSlots.length) {
    slotId = candidateSlots[0].id;
    slotDate = candidateSlots[0].date;
    slotTime = candidateSlots[0].time;
  } else {
    // No slots exist — create a new one.
    slotDate = await resolveEventDateDE();
    slotTime = '16:00 - 16:15';
    const { rows: inserted } = await query(
      `INSERT INTO slots (teacher_id, date, time, booked, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [teacherId, slotDate, slotTime, false, nowIso]
    );
    slotId = inserted[0]?.id;
  }

  const baseUpdate = {
    booked: true,
    status: 'confirmed',
    verified_at: nowIso,
    updated_at: nowIso,
  };

  let update;
  if (visitorType === 'parent') {
    update = {
      ...baseUpdate,
      visitor_type: 'parent',
      parent_name: getArgValue('--parent-name') || 'Max Mustermann',
      student_name: getArgValue('--student-name') || 'Erika Mustermann',
      class_name: getArgValue('--class-name') || 'WG',
      email: getArgValue('--email') || 'test-eltern@beispiel.de',
      message: getArgValue('--message') || 'Test: bestätigter Termin (Eltern)',
    };
  } else {
    update = {
      ...baseUpdate,
      visitor_type: 'company',
      company_name: getArgValue('--company-name') || 'Lidl GmbH',
      representative_name: getArgValue('--representative-name') || 'Max Mustermann',
      trainee_name: getArgValue('--trainee-name') || 'Erika Beispiel',
      class_name: getArgValue('--class-name') || 'WG',
      email: getArgValue('--email') || 'test-betrieb@beispiel.de',
      message: getArgValue('--message') || 'Test: bestätigter Termin (Ausbildungsbetrieb)',
    };
  }

  // Build dynamic SET clause
  const cols = Object.keys(update);
  const vals = Object.values(update);
  const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
  vals.push(slotId);
  await query(`UPDATE slots SET ${setClause} WHERE id = $${vals.length}`, vals);

  console.log('✅ Created/updated confirmed booking');
  console.log(`- teacher_id: ${teacherId}`);
  console.log(`- slot_id:    ${slotId}`);
  console.log(`- date/time:  ${slotDate} ${slotTime}`);
  console.log(`- type:       ${visitorType}`);
  console.log('Open TeacherDashboard as birgit.alef and you should see it under bookings.');
}

main().catch((e) => {
  console.error('Failed to create test booking:', e?.message || e);
  process.exit(1);
});
