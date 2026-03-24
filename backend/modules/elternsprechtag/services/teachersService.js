import { query } from '../../../config/db.js';

export async function listTeachers() {
  // Public endpoint: do not expose private fields (e.g. teacher email)
  const { rows } = await query(
    'SELECT id, first_name, last_name, name, salutation, subject, available_from, available_until FROM teachers ORDER BY last_name, first_name'
  );
  return rows;
}

export async function getTeacherById(teacherId) {
  const { rows } = await query('SELECT id, name FROM teachers WHERE id = $1', [teacherId]);
  return rows[0] || null;
}
