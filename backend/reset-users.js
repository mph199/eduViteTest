import { query } from './config/db.js';

async function resetUsers() {
  try {
    const ids = [4, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
    await query('DELETE FROM users WHERE id = ANY($1)', [ids]);
    console.log('✓ Users deleted:', ids.join(', '));
  } catch (e) {
    console.error('Error deleting users:', e?.message || e);
    process.exit(1);
  }
}

resetUsers().then(() => process.exit(0));
