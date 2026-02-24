import { query } from '../config/db.js';

export async function listTeachers() {
  // Public endpoint: do not expose private fields (e.g. teacher email)
  // During migrations, some columns might not exist yet; keep endpoint resilient.
  try {
    const { rows } = await query(
      'SELECT id, name, salutation, subject, system, room FROM teachers ORDER BY id'
    );
    return rows;
  } catch (e) {
    // Fallback (pre-salutation schema)
    const { rows } = await query(
      'SELECT id, name, subject, system, room FROM teachers ORDER BY id'
    );
    return rows;
  }
}

export async function getTeacherById(id) {
  const { rows } = await query('SELECT * FROM teachers WHERE id = $1', [id]);
  if (rows.length === 0) {
    const err = new Error('Teacher not found');
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
}
