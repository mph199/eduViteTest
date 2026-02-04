import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { supabase } from './config/supabase.js';

function parseArgs(argv) {
  const args = {
    reset: false,
    sharedPassword: null,
    createSlots: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--reset') args.reset = true;
    else if (a.startsWith('--shared-password=')) args.sharedPassword = a.split('=')[1] ?? '';
    else if (a === '--shared-password') args.sharedPassword = argv[++i];
    else if (a === '--create-slots') args.createSlots = true;
  }
  return args;
}

function normalizeSpaces(s) {
  return String(s || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\u202F/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEmail(raw) {
  const s = normalizeSpaces(raw)
    .replace(/\[at\]/gi, '@')
    .replace(/\(at\)/gi, '@')
    .replace(/\s*@\s*/g, '@')
    .toLowerCase();

  // Normalize common typos in provided lists
  if (s.endsWith('@bskb.nrw')) return s.replace(/@bskb\.nrw$/i, '@bksb.nrw');
  if (s.endsWith('@ksb.nrw')) return s.replace(/@ksb\.nrw$/i, '@bksb.nrw');

  return s;
}

function isValidBksbEmail(email) {
  return /^[a-z0-9._%+-]+@bksb\.nrw$/i.test(email);
}

function usernameFromEmail(email) {
  const local = String(email).split('@')[0] || '';
  return local;
}

function isValidUsername(username) {
  // Allow dot + hyphen for usernames like "hildegard.mure-barber"
  return /^[a-z0-9._-]+$/i.test(username) && username.includes('.');
}

function parseTeacherLine(line) {
  // Expected formats like:
  // "Alef, Birgit birgit.alef[at]bksb.nrw"
  // We only require: "Last, First <email>" with any spacing.
  const clean = normalizeSpaces(line);
  if (!clean) return null;

  const m = clean.match(/^([^,]+),\s*([^\s]+)\s+(.+)$/);
  if (!m) {
    return { error: `Unbekanntes Format: "${clean}"` };
  }

  const lastName = normalizeSpaces(m[1]);
  const firstName = normalizeSpaces(m[2]);
  const email = normalizeEmail(m[3]);
  const username = usernameFromEmail(email);

  return {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    email,
    username,
  };
}

function salutationForFirstName(firstName) {
  const male = new Set([
    'Jan',
    'Michael',
    'Edward',
    'Thomas',
    'Manuel',
    'Luis',
    'Merdan',
    'Matthias',
    'Ralf',
    'Mozes',
    'Stephan',
    'Marc',
    'Luca',
    'Walter',
    'Markus',
    'Jens',
    'Achim',
    'Tobias',
    'Henrik',
    'Joachim',
    'Wolfgang',
    'Julian',
    'Benedikt',
    'Mathias',
    'Beda',
  ]);

  const female = new Set([
    'Birgit',
    'Stefanie',
    'Anja',
    'Sarah',
    'Ute',
    'Anke',
    'Nadine',
    'Antonella',
    'Bilitis',
    'Simone',
    'Jessica',
    'Judith',
    'Svenja',
    'Alexandra',
    'Iris',
    'Rebecca',
    'Sophie',
    'Julia',
    'Hildegard',
    'Christel',
    'Anastasia',
    'Kerstin',
    'Gianna',
    'Helin',
    'Katja',
    'Nicole',
    'Miriam',
    'Natalie',
    'Laura',
    'Vanessa',
    'Franziska',
    'Tamara',
    'Barbara',
    'Christine',
    'Katharina',
  ]);

  if (male.has(firstName)) return 'Herr';
  if (female.has(firstName)) return 'Frau';
  return null;
}

function generateTimeSlots(system) {
  const slots = [];
  const startHour = system === 'vollzeit' ? 17 : 16;
  const endHour = system === 'vollzeit' ? 19 : 18;

  let currentHour = startHour;
  let currentMinute = 0;

  while (currentHour < endHour) {
    const start = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
    let endMinute = currentMinute + 15;
    let endHourCalc = currentHour;

    if (endMinute >= 60) {
      endMinute = 0;
      endHourCalc += 1;
    }

    const end = `${String(endHourCalc).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
    slots.push(`${start} - ${end}`);

    currentMinute += 15;
    if (currentMinute >= 60) {
      currentMinute = 0;
      currentHour += 1;
    }
  }

  return slots;
}

async function resolveActiveEventIdAndDate() {
  const formatDateDE = (isoOrDate) => {
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}.${mm}.${yyyy}`;
  };

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('events')
    .select('id, starts_at')
    .eq('status', 'published')
    .or(`booking_opens_at.is.null,booking_opens_at.lte.${nowIso}`)
    .or(`booking_closes_at.is.null,booking_closes_at.gte.${nowIso}`)
    .order('starts_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  const ev = data && data.length ? data[0] : null;
  if (!ev?.id) return { eventId: null, date: null };

  return { eventId: ev.id, date: formatDateDE(ev.starts_at) };
}

async function resetAllTeachersAndTeacherUsers() {
  console.log('Starte Reset (Slots, Teacher-User, Teachers)...');

  // 1) Slots löschen
  const { error: slotsError } = await supabase.from('slots').delete().neq('id', 0);
  if (slotsError) throw slotsError;
  console.log('✓ Slots gelöscht');

  // 2) Teacher users löschen (nur Lehrkräfte)
  const { data: teacherIdsRows, error: idsErr } = await supabase
    .from('teachers')
    .select('id')
    .order('id');
  if (idsErr) throw idsErr;
  const teacherIds = (teacherIdsRows || []).map((r) => r.id).filter(Boolean);

  const { error: usersErr1 } = await supabase.from('users').delete().eq('role', 'teacher');
  if (usersErr1) throw usersErr1;

  if (teacherIds.length) {
    const { error: usersErr2 } = await supabase.from('users').delete().in('teacher_id', teacherIds);
    if (usersErr2) throw usersErr2;
  }

  console.log('✓ Teacher-Users gelöscht');

  // 3) Teachers löschen
  const { error: teachersError } = await supabase.from('teachers').delete().neq('id', 0);
  if (teachersError) throw teachersError;
  console.log('✓ Teachers gelöscht');
}

async function main() {
  const args = parseArgs(process.argv);

  // Ensure DB has the required schema (teachers.email)
  try {
    const { error: schemaErr } = await supabase.from('teachers').select('email').limit(1);
    if (schemaErr) {
      console.error('❌ Datenbank-Schema fehlt: Spalte teachers.email.');
      console.error('Bitte zuerst die Migration ausführen: backend/migrations/add_teacher_email.sql');
      process.exit(1);
    }
  } catch {
    console.error('❌ Datenbank-Schema fehlt: Spalte teachers.email.');
    console.error('Bitte zuerst die Migration ausführen: backend/migrations/add_teacher_email.sql');
    process.exit(1);
  }

  const stdin = await new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (buf += chunk));
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
  });

  const lines = String(stdin)
    .split(/\r?\n/)
    .map((l) => normalizeSpaces(l))
    .filter((l) => l);

  if (lines.length === 0) {
    console.error('Keine Eingabe gefunden. Bitte Teacher-Liste per STDIN übergeben.');
    process.exit(1);
  }

  const parsed = lines.map(parseTeacherLine);
  const errors = parsed.filter((p) => p && p.error);
  if (errors.length) {
    console.error('Fehler beim Parsen:');
    for (const e of errors) console.error(`- ${e.error}`);
    process.exit(1);
  }

  const teachers = parsed;

  const unknownSalutations = [];
  for (const t of teachers) {
    const s = salutationForFirstName(t.firstName);
    if (!s) unknownSalutations.push(`${t.firstName} ${t.lastName} (${t.email})`);
  }
  if (unknownSalutations.length) {
    console.error('Validierungsfehler: Anrede konnte nicht bestimmt werden für:');
    for (const u of unknownSalutations) console.error(`- ${u}`);
    process.exit(1);
  }

  // Validate emails / usernames
  const invalid = [];
  for (const t of teachers) {
    if (!isValidBksbEmail(t.email)) invalid.push(`E-Mail ungültig (muss @bksb.nrw): ${t.email} (${t.name})`);
    if (!isValidUsername(t.username)) invalid.push(`Username ungültig: ${t.username} (${t.name})`);
  }
  if (invalid.length) {
    console.error('Validierungsfehler:');
    for (const m of invalid) console.error(`- ${m}`);
    process.exit(1);
  }

  const sharedPassword = args.sharedPassword ? String(args.sharedPassword).trim() : null;
  if (sharedPassword && sharedPassword.length < 8) {
    console.error('shared password muss mindestens 8 Zeichen haben');
    process.exit(1);
  }

  if (args.reset) {
    await resetAllTeachersAndTeacherUsers();
  } else {
    console.warn('⚠ Kein --reset angegeben: Es werden nur neue Einträge angelegt (kann zu Duplikaten führen).');
  }

  let activeEvent = { eventId: null, date: null };
  if (args.createSlots) {
    activeEvent = await resolveActiveEventIdAndDate();
    if (!activeEvent.eventId || !activeEvent.date) {
      console.error('Kein aktives (published) Event gefunden – Slots können nicht erstellt werden.');
      process.exit(1);
    }
    console.log(`Aktives Event: ${activeEvent.eventId} (${activeEvent.date})`);
  }

  console.log(`\nLege ${teachers.length} Lehrkräfte an...`);

  const credentials = [];

  for (const t of teachers) {
    const password = sharedPassword || crypto.randomBytes(6).toString('base64url');
    const passwordHash = await bcrypt.hash(password, 10);

    const { data: teacher, error: teacherErr } = await supabase
      .from('teachers')
      .insert({
        name: t.name,
        email: t.email,
        salutation: salutationForFirstName(t.firstName),
        subject: 'Sprechstunde',
        system: 'dual',
        room: null,
      })
      .select()
      .single();

    if (teacherErr) {
      console.error('Teacher insert failed:', t.name, teacherErr);
      process.exit(1);
    }

    const { error: userErr } = await supabase
      .from('users')
      .upsert(
        {
          username: t.username,
          password_hash: passwordHash,
          role: 'teacher',
          teacher_id: teacher.id,
        },
        { onConflict: 'username' }
      );

    if (userErr) {
      console.error('User upsert failed:', t.username, userErr);
      process.exit(1);
    }

    if (args.createSlots) {
      const slots = generateTimeSlots('dual');
      const now = new Date().toISOString();
      const slotsToInsert = slots.map((time) => ({
        teacher_id: teacher.id,
        event_id: activeEvent.eventId,
        time,
        date: activeEvent.date,
        booked: false,
        updated_at: now,
      }));

      const { error: slotsErr } = await supabase.from('slots').insert(slotsToInsert);
      if (slotsErr) {
        console.error('Slot insert failed for teacher:', t.username, slotsErr);
        process.exit(1);
      }
    }

    credentials.push({ name: t.name, email: t.email, username: t.username, password });
    console.log(`✓ ${t.name} (${t.email}) -> ${t.username}`);
  }

  console.log('\n✅ Fertig. Zugangsdaten:');
  if (sharedPassword) {
    console.log(`Shared Password: ${sharedPassword}`);
  } else {
    for (const c of credentials) {
      console.log(`${c.username}  |  ${c.password}  |  ${c.email}  |  ${c.name}`);
    }
  }

  console.log('\nHinweis: Bitte ggf. reset-sequences.sql in Supabase ausführen, falls IDs wieder bei 1 starten sollen.');
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('❌ Fehler:', e?.message || e);
  process.exit(1);
});
