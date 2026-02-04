import { supabase } from './config/supabase.js';

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
  if (s.endsWith('@bskb.nrw')) return s.replace(/@bskb\.nrw$/i, '@bksb.nrw');
  if (s.endsWith('@ksb.nrw')) return s.replace(/@ksb\.nrw$/i, '@bksb.nrw');
  return s;
}

function parseTeacherLine(line) {
  const clean = normalizeSpaces(line);
  if (!clean) return null;
  const m = clean.match(/^([^,]+),\s*([^\s]+)\s+(.+)$/);
  if (!m) return { error: `Unbekanntes Format: "${clean}"` };

  const lastName = normalizeSpaces(m[1]);
  const firstName = normalizeSpaces(m[2]);
  const email = normalizeEmail(m[3]);
  return { firstName, lastName, email };
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
    'Jürgen',
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

async function main() {
  // Ensure column exists
  const { error: schemaErr } = await supabase.from('teachers').select('salutation').limit(1);
  if (schemaErr) {
    console.error('❌ Datenbank-Schema fehlt: Spalte teachers.salutation.');
    console.error('Bitte zuerst die Migration ausführen: backend/migrations/add_teacher_salutation.sql');
    process.exit(1);
  }

  const fs = await import('fs');
  const path = await import('path');

  const filePath = path.resolve(process.cwd(), 'backend', 'teachers.txt');
  if (!fs.existsSync(filePath)) {
    console.error('❌ backend/teachers.txt nicht gefunden.');
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = String(raw)
    .split(/\r?\n/)
    .map((l) => normalizeSpaces(l))
    .filter(Boolean);

  const parsed = lines.map(parseTeacherLine);
  const errors = parsed.filter((p) => p && p.error);
  if (errors.length) {
    console.error('Fehler beim Parsen:');
    for (const e of errors) console.error(`- ${e.error}`);
    process.exit(1);
  }

  const unknown = [];
  const updates = parsed.map((t) => {
    const salutation = salutationForFirstName(t.firstName);
    if (!salutation) unknown.push(`${t.firstName} ${t.lastName} (${t.email})`);
    return { ...t, salutation };
  });

  if (unknown.length) {
    console.error('❌ Für folgende Lehrkräfte konnte keine Anrede bestimmt werden:');
    for (const u of unknown) console.error(`- ${u}`);
    console.error('Bitte die Liste im Script ergänzen (salutationForFirstName).');
    process.exit(1);
  }

  console.log(`Setze Anrede für ${updates.length} Lehrkräfte...`);
  for (const u of updates) {
    const { error } = await supabase
      .from('teachers')
      .update({ salutation: u.salutation })
      .eq('email', u.email);
    if (error) {
      console.error('Update fehlgeschlagen:', u.email, error);
      process.exit(1);
    }
  }
  console.log('✅ Fertig.');
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('❌ Fehler:', e?.message || e);
  process.exit(1);
});
