import { query } from '../../../config/db.js';

export async function listTeachers() {
  // Public endpoint: do not expose private fields (e.g. teacher email)
  const { rows } = await query(
    'SELECT id, first_name, last_name, name, salutation, subject, available_from, available_until, room FROM teachers ORDER BY last_name, first_name'
  );
  return rows;
}
