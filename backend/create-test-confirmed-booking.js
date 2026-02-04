#!/usr/bin/env node

import { supabase } from './config/supabase.js';

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

  const { data, error } = await supabase
    .from('users')
    .select('teacher_id')
    .eq('username', username)
    .limit(1)
    .single();
  if (error) throw error;
  return data?.teacher_id ? Number(data.teacher_id) : undefined;
}

async function resolveEventDateDE() {
  try {
    const { data } = await supabase.from('settings').select('event_date').limit(1).single();
    if (data?.event_date) {
      const de = formatDateDE(data.event_date);
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
  const { data: candidateSlots, error: slotSelErr } = await supabase
    .from('slots')
    .select('id,date,time,booked')
    .eq('teacher_id', teacherId)
    .eq('booked', false)
    .order('date')
    .order('time')
    .limit(1);
  if (slotSelErr) throw slotSelErr;

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
    const { data: inserted, error: insErr } = await supabase
      .from('slots')
      .insert({
        teacher_id: teacherId,
        date: slotDate,
        time: slotTime,
        booked: false,
        updated_at: nowIso,
      })
      .select('id')
      .single();
    if (insErr) throw insErr;
    slotId = inserted?.id;
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

  const { error: updErr } = await supabase
    .from('slots')
    .update(update)
    .eq('id', slotId);
  if (updErr) throw updErr;

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
