import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { verifyCredentials, ADMIN_USER, generateToken, verifyToken } from '../middleware/auth.js';
import logger from '../config/logger.js';

const router = express.Router();

const isProduction = process.env.NODE_ENV === 'production';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax', // 'lax' statt 'strict' damit E-Mail-Links (Verify, Buchung) funktionieren
    maxAge: 8 * 60 * 60 * 1000, // 8 hours (matches JWT expiry)
    path: '/',
  };
}

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Username and password required'
    });
  }

  try {
    // 1) System-Admin Credentials (aus Umgebungsvariablen)
    const isValidAdmin = await verifyCredentials(username, password);
    if (isValidAdmin && ADMIN_USER) {
      const user = { username: ADMIN_USER.username, role: 'superadmin' };
      const token = generateToken(user);
      logger.info('Admin login successful');
      res.cookie('token', token, cookieOptions());
      return res.json({
        success: true,
        message: 'Login successful',
        user
      });
    }

    // 2) DB-User (teacher / user) – match by username or email
    const isEmail = username.includes('@');
    const { rows: users } = await query(
      isEmail
        ? 'SELECT id, username, email, role, password_hash, teacher_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1'
        : 'SELECT id, username, email, role, password_hash, teacher_id FROM users WHERE username = $1 LIMIT 1',
      [isEmail ? username : username]
    );

    if (!users || users.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    const dbUser = users[0];

    const passwordOk = await bcrypt.compare(password, dbUser.password_hash || '');
    if (!passwordOk) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    // Nur bekannte Rollen erlauben
    const validRoles = ['admin', 'teacher', 'superadmin', 'ssw'];
    if (!validRoles.includes(dbUser.role)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Unbekannte Rolle' });
    }
    const role = dbUser.role;

    // Modul-Berechtigungen laden
    const { rows: moduleRows } = await query(
      'SELECT module_key FROM user_module_access WHERE user_id = $1',
      [dbUser.id]
    );
    const modules = moduleRows.map(r => r.module_key);

    const user = {
      id: dbUser.id,
      username: dbUser.username,
      role,
      teacherId: dbUser.teacher_id || undefined,
      modules: modules.length > 0 ? modules : undefined
    };
    const token = generateToken(user);

    logger.info({ username: dbUser.username, role }, 'DB login successful');

    res.cookie('token', token, cookieOptions());
    return res.json({
      success: true,
      message: 'Login successful',
      user
    });
  } catch (err) {
    logger.error({ err }, 'Login error');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed'
    });
  }
});

/**
 * POST /api/auth/logout
 * Token wird clientseitig gelöscht
 */
router.post('/logout', (_req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Optional: accept DELETE for clients using DELETE /logout
router.delete('/logout', (_req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

/**
 * GET /api/auth/verify
 * Checks if token is valid
 */
router.get('/verify', (req, res) => {
  const token = req.cookies?.token || null;

  if (!token) {
    return res.json({ authenticated: false });
  }
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    user: {
      username: decoded.username,
      role: decoded.role,
      teacherId: decoded.teacherId,
      modules: decoded.modules || []
    }
  });
});

export default router;
