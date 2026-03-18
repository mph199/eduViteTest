import express from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../../../../middleware/auth.js';
import { query } from '../../../../config/db.js';
import logger from '../../../../config/logger.js';
import { validatePassword } from '../../../../shared/validatePassword.js';
import { requireTeacher } from './lib/middleware.js';

const router = express.Router();

/**
 * PUT /api/teacher/password
 */
router.put('/password', requireAuth, requireTeacher, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const pwCheck = validatePassword(typeof newPassword === 'string' ? newPassword.trim() : newPassword);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.message });
  }
  try {
    const username = req.user.username;
    const { rows: users } = await query(
      'SELECT id, username, email, role, teacher_id, password_hash, created_at FROM users WHERE username = $1 LIMIT 1',
      [username]
    );
    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }
    const user = users[0];

    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password_hash || ''))) {
      return res.status(403).json({ error: 'Aktuelles Passwort ist falsch' });
    }

    const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
    await query('UPDATE users SET password_hash = $1, token_version = token_version + 1, force_password_change = false WHERE id = $2', [passwordHash, user.id]);

    res.json({ success: true, message: 'Passwort erfolgreich geändert' });
  } catch (error) {
    logger.error({ err: error }, 'Error changing password');
    res.status(500).json({ error: 'Fehler beim Ändern des Passworts' });
  }
});

export default router;
