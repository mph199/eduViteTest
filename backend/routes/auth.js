import express from 'express';
import bcrypt from 'bcryptjs';
import { createRateLimiter } from '../config/rateLimiter.js';
import { db } from '../db/database.js';
import { verifyCredentials, ADMIN_USER, generateToken, verifyToken } from '../middleware/auth.js';
import { logSecurityEvent } from '../middleware/audit-log.js';
import logger from '../config/logger.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../schemas/auth.js';

const router = express.Router();

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anmeldeversuche. Bitte spaeter erneut versuchen.' },
});

const isProduction = process.env.NODE_ENV === 'production';

const cookieSecure = process.env.COOKIE_SECURE && process.env.COOKIE_SECURE !== ''
  ? process.env.COOKIE_SECURE === 'true'
  : isProduction;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

let adminFailedAttempts = 0;
let adminLockedUntil = 0;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  };
}

/**
 * POST /api/auth/login
 */
router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1) System-Admin Credentials (env vars)
    if (ADMIN_USER && username === ADMIN_USER.username) {
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
        return res.json({ success: true, message: 'Login successful', user });
      }

      adminFailedAttempts += 1;
      if (adminFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        adminLockedUntil = Date.now() + LOCKOUT_DURATION_MS;
        logSecurityEvent('ACCOUNT_LOCKED', { username, attempts: adminFailedAttempts }, req.ip);
      } else {
        logSecurityEvent('LOGIN_FAIL', { username, reason: 'wrong_password', attempts: adminFailedAttempts }, req.ip);
      }

      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    // 2) DB-User — explicit columns, NO password_hash in result object
    const isEmail = username.includes('@');
    const dbUser = await db.selectFrom('users')
      .select([
        'id', 'username', 'email', 'role', 'password_hash',
        'teacher_id', 'failed_login_attempts', 'locked_until',
        'token_version', 'force_password_change',
      ])
      .where(
        isEmail ? 'email' : 'username',
        isEmail ? '=' : '=',
        isEmail ? username.toLowerCase() : username,
      )
      .executeTakeFirst();

    if (!dbUser) {
      await bcrypt.compare(password, '$2a$10$x'.padEnd(60, '.'));
      logSecurityEvent('LOGIN_FAIL', { username, reason: 'user_not_found' }, req.ip);
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

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
      const lockUntilVal = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();

      const updated = await db.updateTable('users')
        .set((eb) => ({
          failed_login_attempts: eb('failed_login_attempts', '+', 1),
          last_failed_login: new Date(),
        }))
        .where('id', '=', dbUser.id)
        .returning('failed_login_attempts')
        .executeTakeFirst();

      const newAttempts = updated?.failed_login_attempts || 0;

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        await db.updateTable('users')
          .set({ locked_until: new Date(Date.now() + LOCKOUT_DURATION_MS) })
          .where('id', '=', dbUser.id)
          .execute();

        logSecurityEvent('ACCOUNT_LOCKED', { username, attempts: newAttempts }, req.ip);
      } else {
        logSecurityEvent('LOGIN_FAIL', { username, reason: 'wrong_password', attempts: newAttempts }, req.ip);
      }

      return res.status(401).json({
        error: 'Unauthorized',
        message: newAttempts >= MAX_FAILED_ATTEMPTS
          ? 'Konto wurde nach zu vielen Fehlversuchen gesperrt.'
          : 'Invalid credentials'
      });
    }

    // Reset failed login attempts on successful login
    if (dbUser.failed_login_attempts > 0 || dbUser.locked_until) {
      await db.updateTable('users')
        .set({ failed_login_attempts: 0, locked_until: null, last_failed_login: null })
        .where('id', '=', dbUser.id)
        .execute();
    }

    // Only allow known roles
    const validRoles = ['admin', 'teacher', 'superadmin'];
    if (!validRoles.includes(dbUser.role)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Unbekannte Rolle' });
    }

    // Load module permissions
    const moduleRows = await db.selectFrom('user_module_access')
      .select('module_key')
      .where('user_id', '=', dbUser.id)
      .execute();
    const modules = moduleRows.map(r => r.module_key);

    const adminRows = await db.selectFrom('user_admin_access')
      .select('module_key')
      .where('user_id', '=', dbUser.id)
      .execute();
    const adminModules = adminRows.map(r => r.module_key);

    // Build user object (NO password_hash)
    const user = {
      id: dbUser.id,
      username: dbUser.username,
      role: dbUser.role,
      teacherId: dbUser.teacher_id || undefined,
      modules: modules.length > 0 ? modules : undefined,
      adminModules: adminModules.length > 0 ? adminModules : undefined,
      tokenVersion: dbUser.token_version ?? 0,
      forcePasswordChange: !!dbUser.force_password_change,
    };
    const token = generateToken(user);

    logger.info({ username: dbUser.username, role: dbUser.role }, 'DB login successful');

    res.cookie('token', token, cookieOptions());
    return res.json({ success: true, message: 'Login successful', user });
  } catch (err) {
    logger.error({ err }, 'Login error');
    res.status(500).json({ error: 'Internal Server Error', message: 'Login failed' });
  }
});

/**
 * Shared logout logic — invalidate token + clear cookie.
 */
async function handleLogout(req, res) {
  try {
    const token = req.cookies?.token;
    if (token) {
      const decoded = verifyToken(token);
      if (decoded?.id) {
        await db.updateTable('users')
          .set((eb) => ({ token_version: eb('token_version', '+', 1) }))
          .where('id', '=', decoded.id)
          .execute();
      }
    }
  } catch (err) {
    logger.error({ err }, 'Token revocation on logout failed');
  }
  res.clearCookie('token', cookieOptions());
  res.json({ success: true, message: 'Logout successful' });
}

router.post('/logout', handleLogout);
router.delete('/logout', handleLogout);

/**
 * GET /api/auth/verify
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

  let liveModules = decoded.modules || [];
  let liveAdminModules = [];
  let forcePasswordChange = decoded._fpc ?? !!decoded.fpc;

  if (decoded.id) {
    try {
      const tv = typeof decoded.tv === 'number' ? decoded.tv : -1;

      // Check token version + force_password_change (NO password_hash loaded)
      const userRow = await db.selectFrom('users')
        .select(['token_version', 'force_password_change'])
        .where('id', '=', decoded.id)
        .executeTakeFirst();

      if (userRow && tv < userRow.token_version) {
        return res.json({ authenticated: false });
      }
      if (userRow) {
        forcePasswordChange = !!userRow.force_password_change;
      }

      // Live module permissions from DB
      const moduleRows = await db.selectFrom('user_module_access')
        .select('module_key')
        .where('user_id', '=', decoded.id)
        .execute();
      liveModules = moduleRows.map(r => r.module_key);

      const adminRows = await db.selectFrom('user_admin_access')
        .select('module_key')
        .where('user_id', '=', decoded.id)
        .execute();
      liveAdminModules = adminRows.map(r => r.module_key);
    } catch (verifyErr) {
      logger.warn({ err: verifyErr }, 'Token version check failed, proceeding without');
    }
  }

  res.json({
    authenticated: true,
    user: {
      username: decoded.username,
      role: decoded.role,
      teacherId: decoded.teacherId,
      modules: liveModules,
      adminModules: liveAdminModules,
      forcePasswordChange,
    }
  });
});

export default router;
