import bcrypt from 'bcryptjs';
import { supabase } from './config/supabase.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--teacher-id')) {
      const [, val] = a.split('=');
      args.teacherId = val ? Number(val) : Number(argv[++i]);
    } else if (a.startsWith('--username')) {
      const [, val] = a.split('=');
      args.username = val ?? argv[++i];
    } else if (a.startsWith('--password')) {
      const [, val] = a.split('=');
      args.password = val ?? argv[++i];
    }
  }
  return args;
}

async function createTeacherUser() {
  const { teacherId: teacherIdArg, username = 'lehrer', password = 'teacher123' } = parseArgs(process.argv);
  const passwordHash = await bcrypt.hash(password, 10);

  // Resolve teacher
  let teacherId = teacherIdArg;
  let teacherName = '';
  if (!teacherId) {
    const { data: teachers, error } = await supabase
      .from('teachers')
      .select('*')
      .limit(1);
    if (error) throw error;
    if (!teachers || teachers.length === 0) {
      console.log('Keine Lehrer in der Datenbank gefunden. Bitte erst einen Lehrer anlegen.');
      return;
    }
    teacherId = teachers[0].id;
    teacherName = teachers[0].name;
  } else {
    const { data: t, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', teacherId)
      .single();
    if (error) {
      console.error('Lehrer konnte nicht geladen werden:', error.message || error);
      return;
    }
    teacherName = t.name;
  }

  // Ensure user exists or upsert
  const { error: upsertErr } = await supabase
    .from('users')
    .upsert({
      username,
      password_hash: passwordHash,
      role: 'teacher',
      teacher_id: teacherId
    }, { onConflict: 'username' });

  if (upsertErr) {
    console.error('Fehler beim Erstellen/Aktualisieren des Users:', upsertErr);
    return;
  }

  console.log('✓ Teacher-User bereit:');
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);
  console.log(`  Verknüpft mit: ${teacherName} (ID: ${teacherId})`);
}

createTeacherUser().then(() => process.exit(0));
