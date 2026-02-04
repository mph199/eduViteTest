import bcrypt from 'bcryptjs';
import { supabase } from './config/supabase.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--teacher-id')) {
      const [, val] = a.split('=');
      args.teacherId = val ? Number(val) : Number(argv[++i]);
    } else if (a.startsWith('--password')) {
      const [, val] = a.split('=');
      args.password = val ?? argv[++i];
    }
  }
  return args;
}

async function upsertHerrHuhn() {
  const { teacherId: teacherIdArg, password: providedPassword } = parseArgs(process.argv);
  let teacherId = teacherIdArg || 1;

  // Resolve teacher by id
  try {
    const { data: teacher, error: tErr } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', teacherId)
      .single();
    if (tErr) throw tErr;
    if (!teacher) {
      console.error(`Lehrer mit ID ${teacherId} nicht gefunden. Bitte zuerst anlegen.`);
      process.exit(1);
    }
  } catch (e) {
    console.error('Fehler beim Laden der Lehrkraft:', e?.message || e);
    process.exit(1);
  }

  const username = 'herrhuhn';
  const password = (providedPassword && providedPassword.trim().length >= 8) ? providedPassword.trim() : 'huhn12345';
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const { error: upsertErr } = await supabase
      .from('users')
      .upsert({
        username,
        password_hash: passwordHash,
        role: 'teacher',
        teacher_id: teacherId
      }, { onConflict: 'username' });
    if (upsertErr) throw upsertErr;

    console.log('✓ Benutzer upsert erfolgreich:');
    console.log(`  Username: ${username}`);
    console.log(`  Passwort: ${password}`);
    console.log(`  Verknüpft mit Lehrkraft ID: ${teacherId}`);
  } catch (e) {
    console.error('Fehler beim Upsert des Users:', e?.message || e);
    process.exit(1);
  }
}

upsertHerrHuhn().then(() => process.exit(0));
