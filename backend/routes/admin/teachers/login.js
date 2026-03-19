import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../../../middleware/auth.js';
import { query } from '../../../config/db.js';
import logger from '../../../config/logger.js';

const router = express.Router();

// PUT /api/admin/teachers/:id/reset-login
router.put('/teachers/:id/reset-login', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }

  try {
    const { rows: users } = await query('SELECT id, username, email, role, teacher_id, created_at FROM users WHERE teacher_id = $1 LIMIT 1', [teacherId]);
    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'Kein Benutzer für diese Lehrkraft gefunden' });
    }

    const user = users[0];
    const tempPassword = crypto.randomBytes(6).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await query('UPDATE users SET password_hash = $1, token_version = token_version + 1, force_password_change = true WHERE id = $2', [passwordHash, user.id]);

    res.json({ success: true, user: { username: user.username, tempPassword } });
  } catch (error) {
    logger.error({ err: error }, 'Error resetting teacher login');
    res.status(500).json({ error: 'Failed to reset teacher login' });
  }
});

export default router;
