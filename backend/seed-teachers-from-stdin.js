import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from './config/db.js';
import { formatDateDE } from './utils/timeWindows.js';
import logger from './config/logger.js';

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

  const ev = rows.length ? rows[0] : null;
  if (!ev?.id) return { eventId: null, date: null };

  return { eventId: ev.id, date: formatDateDE(ev.starts_at) };
}

async function resetAllTeachersAndTeacherUsers() {
  logger.info('Starte Reset (Slots, Teacher-User, Teachers)...');

  // 1) Slots löschen
  await query('DELETE FROM slots');
  logger.info('Slots geloescht');

  // 2) Teacher users löschen (nur Lehrkräfte)
  const { rows: teacherIdsRows } = await query('SELECT id FROM teachers ORDER BY id');
  const teacherIds = (teacherIdsRows || []).map((r) => r.id).filter(Boolean);

  await query("DELETE FROM users WHERE role = 'teacher'");

  if (teacherIds.length) {
    await query('DELETE FROM users WHERE teacher_id = ANY($1)', [teacherIds]);
  }

  logger.info('Teacher-Users geloescht');

  // 3) Teachers löschen
  await query('DELETE FROM teachers');
  logger.info('Teachers geloescht');
}

async function main() {
  const args = parseArgs(process.argv);

  // Ensure DB has the required schema (teachers.email)
  try {
    await query('SELECT email FROM teachers LIMIT 1');
  } catch {
    logger.error('Datenbank-Schema fehlt: Spalte teachers.email.');
    logger.error('Bitte zuerst die Migration ausfuehren: backend/migrations/add_teacher_email.sql');
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
    logger.error('Keine Eingabe gefunden. Bitte Teacher-Liste per STDIN uebergeben.');
    process.exit(1);
  }

  const parsed = lines.map(parseTeacherLine);
  const errors = parsed.filter((p) => p && p.error);
  if (errors.length) {
    logger.error('Fehler beim Parsen:');
    for (const e of errors) logger.error(`- ${e.error}`);
    process.exit(1);
  }

  const teachers = parsed;

  const unknownSalutations = [];
  for (const t of teachers) {
    const s = salutationForFirstName(t.firstName);
    if (!s) unknownSalutations.push(`${t.firstName} ${t.lastName} (${t.email})`);
  }
  if (unknownSalutations.length) {
    logger.error('Validierungsfehler: Anrede konnte nicht bestimmt werden fuer:');
    for (const u of unknownSalutations) logger.error(`- ${u}`);
    process.exit(1);
  }

  // Validate emails / usernames
  const invalid = [];
  for (const t of teachers) {
    if (!isValidBksbEmail(t.email)) invalid.push(`E-Mail ungültig (muss @bksb.nrw): ${t.email} (${t.firstName} ${t.lastName})`);
    if (!isValidUsername(t.username)) invalid.push(`Username ungültig: ${t.username} (${t.firstName} ${t.lastName})`);
  }
  if (invalid.length) {
    logger.error('Validierungsfehler:');
    for (const m of invalid) logger.error(`- ${m}`);
    process.exit(1);
  }

  const sharedPassword = args.sharedPassword ? String(args.sharedPassword).trim() : null;
  if (sharedPassword && sharedPassword.length < 8) {
    logger.error('shared password muss mindestens 8 Zeichen haben');
    process.exit(1);
  }

  if (args.reset) {
    await resetAllTeachersAndTeacherUsers();
  } else {
    logger.warn('Kein --reset angegeben: Es werden nur neue Eintraege angelegt (kann zu Duplikaten fuehren).');
  }

  let activeEvent = { eventId: null, date: null };
  if (args.createSlots) {
    activeEvent = await resolveActiveEventIdAndDate();
    if (!activeEvent.eventId || !activeEvent.date) {
      logger.error('Kein aktives (published) Event gefunden – Slots koennen nicht erstellt werden.');
      process.exit(1);
    }
    logger.info({ eventId: activeEvent.eventId, date: activeEvent.date }, 'Aktives Event gefunden');
  }

  logger.info({ count: teachers.length }, 'Lege Lehrkraefte an...');

  const credentials = [];

  for (const t of teachers) {
    const password = sharedPassword || crypto.randomBytes(6).toString('base64url');
    const passwordHash = await bcrypt.hash(password, 10);

    const { rows: teacherRows } = await query(
      `INSERT INTO teachers (first_name, last_name, email, salutation, subject, system, room)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [t.firstName, t.lastName, t.email, salutationForFirstName(t.firstName), 'Sprechstunde', 'dual', null]
    );
    const teacher = teacherRows[0];

    if (!teacher) {
      logger.error({ firstName: t.firstName, lastName: t.lastName }, 'Teacher insert failed: no row returned');
      process.exit(1);
    }

    await query(
      `INSERT INTO users (username, password_hash, role, teacher_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             teacher_id = EXCLUDED.teacher_id`,
      [t.username, passwordHash, 'teacher', teacher.id]
    );

    if (args.createSlots) {
      const slots = generateTimeSlots('dual');
      const now = new Date().toISOString();

      // Build parameterized bulk insert for slots
      const slotCols = ['teacher_id', 'event_id', 'time', 'date', 'booked', 'updated_at'];
      const slotPlaceholders = [];
      const slotVals = [];
      let pIdx = 1;
      for (const time of slots) {
        slotPlaceholders.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5})`);
        slotVals.push(teacher.id, activeEvent.eventId, time, activeEvent.date, false, now);
        pIdx += 6;
      }

      await query(
        `INSERT INTO slots (${slotCols.join(', ')}) VALUES ${slotPlaceholders.join(', ')}`,
        slotVals
      );
    }

    credentials.push({ name: `${t.firstName} ${t.lastName}`, email: t.email, username: t.username, password });
    logger.info({ name: `${t.firstName} ${t.lastName}`, email: t.email, username: t.username }, 'Lehrkraft angelegt');
  }

  logger.info({ total: credentials.length }, 'Fertig. Zugangsdaten:');
  if (sharedPassword) {
    logger.info({ password: sharedPassword }, 'Shared Password (einmalige Ausgabe)');
  } else {
    for (const c of credentials) {
      logger.info({ username: c.username, password: c.password, email: c.email, name: c.name }, 'Zugangsdaten');
    }
  }

  logger.info('Hinweis: Bitte ggf. reset-sequences.sql ausfuehren, falls IDs wieder bei 1 starten sollen.');
}

main().then(() => process.exit(0)).catch((e) => {
  logger.error({ err: e?.message || e }, 'Seed-Fehler');
  process.exit(1);
});
