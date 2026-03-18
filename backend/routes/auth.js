import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { query } from '../config/db.js';
import { verifyCredentials, ADMIN_USER, generateToken, verifyToken } from '../middleware/auth.js';
import { logSecurityEvent } from '../middleware/audit-log.js';
import logger from '../config/logger.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 8,                      // 8 login attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anmeldeversuche. Bitte spaeter erneut versuchen.' },
});

const isProduction = process.env.NODE_ENV === 'production';

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

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
router.post('/login', loginLimiter, async (req, res) => {
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
        ? 'SELECT id, username, email, role, password_hash, teacher_id, failed_login_attempts, locked_until FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1'
        : 'SELECT id, username, email, role, password_hash, teacher_id, failed_login_attempts, locked_until FROM users WHERE username = $1 LIMIT 1',
      [isEmail ? username : username]
    );

    if (!users || users.length === 0) {
      logSecurityEvent('LOGIN_FAIL', { username, reason: 'user_not_found' }, req.ip);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    const dbUser = users[0];

    // Account lockout check
    if (dbUser.locked_until && new Date(dbUser.locked_until) > new Date()) {
      const remainingMs = new Date(dbUser.locked_until) - new Date();
      const remainingMin = Math.ceil(remainingMs / 60000);
      logSecurityEvent('LOGIN_LOCKED', { username, remainingMin }, req.ip);
      return res.status(423).json({
        error: 'Account gesperrt',
        message: `Konto ist gesperrt. Bitte in ${remainingMin} Minuten erneut versuchen.`
      });
    }

    const passwordOk = await bcrypt.compare(password, dbUser.password_hash || '');
    if (!passwordOk) {
      // Increment failed attempts
      const newAttempts = (dbUser.failed_login_attempts || 0) + 1;
      const lockUntil = newAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
        : null;

      await query(
        'UPDATE users SET failed_login_attempts = $1, last_failed_login = NOW(), locked_until = $2 WHERE id = $3',
        [newAttempts, lockUntil, dbUser.id]
      );

      if (lockUntil) {
        logSecurityEvent('ACCOUNT_LOCKED', { username, attempts: newAttempts }, req.ip);
      } else {
        logSecurityEvent('LOGIN_FAIL', { username, reason: 'wrong_password', attempts: newAttempts }, req.ip);
      }

      return res.status(401).json({
        error: 'Unauthorized',
        message: lockUntil
          ? 'Konto wurde nach zu vielen Fehlversuchen gesperrt.'
          : 'Invalid credentials'
      });
    }

    // Reset failed login attempts on successful login
    if (dbUser.failed_login_attempts > 0 || dbUser.locked_until) {
      await query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_failed_login = NULL WHERE id = $1',
        [dbUser.id]
      );
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
  res.clearCookie('token', cookieOptions());
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Optional: accept DELETE for clients using DELETE /logout
router.delete('/logout', (_req, res) => {
  res.clearCookie('token', cookieOptions());
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
