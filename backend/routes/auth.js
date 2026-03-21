import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { query } from '../config/db.js';
import { verifyCredentials, ADMIN_USER, generateToken, verifyToken } from '../middleware/auth.js';
import { logSecurityEvent } from '../middleware/audit-log.js';
import logger from '../config/logger.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../schemas/auth.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 8,                      // 8 login attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anmeldeversuche. Bitte spaeter erneut versuchen.' },
});

const isProduction = process.env.NODE_ENV === 'production';

// Cookie secure flag: explicit env wins, otherwise derive from NODE_ENV.
// Set COOKIE_SECURE=false on VPS deployments without HTTPS (IP-only access).
const cookieSecure = process.env.COOKIE_SECURE && process.env.COOKIE_SECURE !== ''
  ? process.env.COOKIE_SECURE === 'true'
  : isProduction;

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// In-memory lockout for ADMIN_USER (no DB row to track against)
let adminFailedAttempts = 0;
let adminLockedUntil = 0;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'lax', // 'lax' statt 'strict' damit E-Mail-Links (Verify, Buchung) funktionieren
    maxAge: 8 * 60 * 60 * 1000, // 8 hours (matches JWT expiry)
    path: '/',
  };
}

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1) System-Admin Credentials (aus Umgebungsvariablen)
    if (ADMIN_USER && username === ADMIN_USER.username) {
      // In-memory lockout check for admin account
      if (adminLockedUntil > Date.now()) {
        logSecurityEvent('LOGIN_LOCKED', { username }, req.ip);
        return res.status(423).json({
          error: 'Account gesperrt',
          message: 'Konto voruebergehend gesperrt. Bitte spaeter erneut versuchen.'
        });
      }

      const isValidAdmin = await verifyCredentials(username, password);
      if (isValidAdmin) {
        adminFailedAttempts = 0;
        adminLockedUntil = 0;
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

      // Admin password wrong
      adminFailedAttempts += 1;
      if (adminFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        adminLockedUntil = Date.now() + LOCKOUT_DURATION_MS;
        logSecurityEvent('ACCOUNT_LOCKED', { username, attempts: adminFailedAttempts }, req.ip);
      } else {
        logSecurityEvent('LOGIN_FAIL', { username, reason: 'wrong_password', attempts: adminFailedAttempts }, req.ip);
      }

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    // 2) DB-User (teacher / user) – match by username or email
    const isEmail = username.includes('@');
    const { rows: users } = await query(
      isEmail
        ? 'SELECT id, username, email, role, password_hash, teacher_id, failed_login_attempts, locked_until, token_version, force_password_change FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1'
        : 'SELECT id, username, email, role, password_hash, teacher_id, failed_login_attempts, locked_until, token_version, force_password_change FROM users WHERE username = $1 LIMIT 1',
      [username]
    );

    if (!users || users.length === 0) {
      // Constant-time compare to prevent timing-based user enumeration
      await bcrypt.compare(password, '$2a$10$x'.padEnd(60, '.'));
      logSecurityEvent('LOGIN_FAIL', { username, reason: 'user_not_found' }, req.ip);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    const dbUser = users[0];

    // Account lockout check
    if (dbUser.locked_until && new Date(dbUser.locked_until).getTime() > Date.now()) {
      logSecurityEvent('LOGIN_LOCKED', { username }, req.ip);
      return res.status(423).json({
        error: 'Account gesperrt',
        message: 'Konto voruebergehend gesperrt. Bitte spaeter erneut versuchen.'
      });
    }

    const passwordOk = await bcrypt.compare(password, dbUser.password_hash || '');
    if (!passwordOk) {
      // Atomic increment to prevent race conditions with parallel requests
      const lockUntilVal = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
      const { rows: updated } = await query(
        `UPDATE users SET
           failed_login_attempts = failed_login_attempts + 1,
           last_failed_login = NOW(),
           locked_until = CASE WHEN failed_login_attempts + 1 >= $1 THEN $2::timestamptz ELSE locked_until END
         WHERE id = $3
         RETURNING failed_login_attempts`,
        [MAX_FAILED_ATTEMPTS, lockUntilVal, dbUser.id]
      );

      const newAttempts = updated[0]?.failed_login_attempts || 0;
      const locked = newAttempts >= MAX_FAILED_ATTEMPTS;

      if (locked) {
        logSecurityEvent('ACCOUNT_LOCKED', { username, attempts: newAttempts }, req.ip);
      } else {
        logSecurityEvent('LOGIN_FAIL', { username, reason: 'wrong_password', attempts: newAttempts }, req.ip);
      }

      return res.status(401).json({
        error: 'Unauthorized',
        message: locked
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
      modules: modules.length > 0 ? modules : undefined,
      tokenVersion: dbUser.token_version ?? 0,
      forcePasswordChange: !!dbUser.force_password_change,
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
 * Invalidates token server-side by incrementing token_version, then clears cookie.
 */
router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (token) {
      const decoded = verifyToken(token);
      if (decoded?.id) {
        await query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [decoded.id]);
      }
    }
  } catch (err) {
    logger.error({ err }, 'Token revocation on logout failed');
  }
  res.clearCookie('token', cookieOptions());
  res.json({ success: true, message: 'Logout successful' });
});

// Optional: accept DELETE for clients using DELETE /logout
router.delete('/logout', async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (token) {
      const decoded = verifyToken(token);
      if (decoded?.id) {
        await query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [decoded.id]);
      }
    }
  } catch (err) {
    logger.error({ err }, 'Token revocation on logout failed');
  }
  res.clearCookie('token', cookieOptions());
  res.json({ success: true, message: 'Logout successful' });
});

/**
 * GET /api/auth/verify
 * Checks if token is valid
 */
router.get('/verify', async (req, res) => {
  const token = req.cookies?.token || null;

  if (!token) {
    return res.json({ authenticated: false });
  }
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.json({ authenticated: false });
  }

  // Check token_version for DB-users (pre-migration tokens without tv claim default to -1)
  if (decoded.id) {
    try {
      const tv = typeof decoded.tv === 'number' ? decoded.tv : -1;
      const { rows } = await query('SELECT token_version, force_password_change FROM users WHERE id = $1', [decoded.id]);
      if (rows.length > 0 && tv < rows[0].token_version) {
        return res.json({ authenticated: false });
      }
      // Carry force_password_change from DB (source of truth, not JWT)
      if (rows.length > 0) {
        decoded._fpc = !!rows[0].force_password_change;
      }
    } catch (_err) {
      // fail open for availability
    }
  }

  res.json({
    authenticated: true,
    user: {
      username: decoded.username,
      role: decoded.role,
      teacherId: decoded.teacherId,
      modules: decoded.modules || [],
      forcePasswordChange: decoded._fpc ?? !!decoded.fpc,
    }
  });
});

export default router;
