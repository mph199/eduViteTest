import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../../../middleware/auth.js';
import { db } from '../../../db/database.js';
import logger from '../../../config/logger.js';

const router = express.Router();

// PUT /api/admin/teachers/:id/reset-login
router.put('/teachers/:id/reset-login', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) return res.status(400).json({ error: 'Invalid teacher ID' });

  try {
    const user = await db.selectFrom('users')
      .select(['id', 'username', 'email', 'role', 'teacher_id', 'created_at'])
      .where('teacher_id', '=', teacherId)
      .executeTakeFirst();

    if (!user) return res.status(404).json({ error: 'Kein Benutzer für diese Lehrkraft gefunden' });

    const tempPassword = crypto.randomBytes(6).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await db.updateTable('users')
      .set((eb) => ({
        password_hash: passwordHash,
        token_version: eb('token_version', '+', 1),
        force_password_change: true,
      }))
      .where('id', '=', user.id)
      .execute();

    res.set('Cache-Control', 'no-store');
    res.json({ success: true, user: { username: user.username, tempPassword } });
  } catch (error) {
    logger.error({ err: error }, 'Error resetting teacher login');
    res.status(500).json({ error: 'Failed to reset teacher login' });
  }
});

export default router;
