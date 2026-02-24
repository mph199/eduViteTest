import bcrypt from 'bcryptjs';
import { query } from './config/db.js';

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
    const { rows: teachers } = await query('SELECT * FROM teachers ORDER BY id LIMIT 1');
    if (!teachers || teachers.length === 0) {
      console.log('Keine Lehrer in der Datenbank gefunden. Bitte erst einen Lehrer anlegen.');
      return;
    }
    teacherId = teachers[0].id;
    teacherName = teachers[0].name;
  } else {
    const { rows } = await query('SELECT * FROM teachers WHERE id = $1', [teacherId]);
    const t = rows[0];
    if (!t) {
      console.error('Lehrer konnte nicht geladen werden: not found');
      return;
    }
    teacherName = t.name;
  }

  // Ensure user exists or upsert
  await query(
    `INSERT INTO users (username, password_hash, role, teacher_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           teacher_id = EXCLUDED.teacher_id`,
    [username, passwordHash, 'teacher', teacherId]
  );

  console.log('✓ Teacher-User bereit:');
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);
  console.log(`  Verknüpft mit: ${teacherName} (ID: ${teacherId})`);
}

createTeacherUser().then(() => process.exit(0));
