import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';
import { logSecurityEvent } from './audit-log.js';
import { query } from '../config/db.js';

// Admin User Credentials – aus Umgebungsvariablen laden
const adminUsername = process.env.ADMIN_USERNAME;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
export const ADMIN_USER = adminUsername && adminPasswordHash
  ? { username: adminUsername, passwordHash: adminPasswordHash }
  : null;

if (!ADMIN_USER) {
  logger.warn('[auth] ADMIN_USERNAME / ADMIN_PASSWORD_HASH nicht gesetzt – System-Admin-Login deaktiviert. Nur DB-User können sich anmelden.');
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET oder SESSION_SECRET Umgebungsvariable muss gesetzt sein');
}
const JWT_EXPIRES_IN = '8h';

/**
 * Generate JWT token for user
 */
export function generateToken(user) {
  const payload = { username: user.username, role: user.role };
  if (user.id) {
    payload.id = user.id;
  }
  if (user.teacherId) {
    payload.teacherId = user.teacherId;
  }
  if (user.modules && user.modules.length > 0) {
    payload.modules = user.modules;
  }
  if (typeof user.tokenVersion === 'number') {
    payload.tv = user.tokenVersion;
  }
  if (user.forcePasswordChange) {
    payload.fpc = true;
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Check if a decoded user has access to a specific module.
 * Admin/Superadmin always have access to all modules.
 */
export function hasModuleAccess(user, moduleKey) {
  if (user.role === 'admin' || user.role === 'superadmin') return true;
  return Array.isArray(user.modules) && user.modules.includes(moduleKey);
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from httpOnly cookie only.
 * Bearer-Header-Extraktion wurde entfernt um die Angriffsflaeche zu reduzieren.
 */
function extractToken(req) {
  if (req.cookies?.token) {
    return req.cookies.token;
  }
  return null;
}

/**
 * Shared authentication logic for all middleware.
 * Returns decoded token or sends error response.
 * Checks token_version against DB for DB-users (revocation support).
 */
async function authenticate(req, res) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    return null;
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    return null;
  }

  // Token-version check for DB-users (not env-based ADMIN_USER which has no DB row)
  // Tokens without tv claim (pre-migration) are also checked: tv defaults to -1
  if (decoded.id) {
    try {
      const tv = typeof decoded.tv === 'number' ? decoded.tv : -1;
      const { rows } = await query('SELECT token_version FROM users WHERE id = $1', [decoded.id]);
      if (rows.length === 0 || tv < rows[0].token_version) {
        res.status(401).json({ error: 'Unauthorized', message: 'Token revoked' });
        return null;
      }
    } catch (err) {
      logger.error({ err, userId: decoded.id, path: req.path }, 'Token version check failed – rejecting token (fail-closed)');
      res.status(503).json({ error: 'Service Unavailable', message: 'Authentication service temporarily unavailable' });
      return null;
    }
  }

  return decoded;
}

/**
 * Check force_password_change: block all API access except password-change endpoint.
 * Returns true if request is blocked, false if allowed to proceed.
 */
function enforcePasswordChange(decoded, req, res) {
  if (!decoded.fpc) return false;
  // Allow password change endpoint
  if (req.method === 'PUT' && req.path === '/password') return false;
  // Allow logout
  if (req.path === '/logout') return false;
  // Allow verify (needed for frontend auth state)
  if (req.path === '/verify') return false;
  res.status(403).json({ error: 'Forbidden', message: 'Password change required' });
  return true;
}

/**
 * Middleware: Requires authenticated token
 */
export async function requireAuth(req, res, next) {
  const decoded = await authenticate(req, res);
  if (!decoded) return;
  if (enforcePasswordChange(decoded, req, res)) return;
  req.user = decoded;
  return next();
}

/**
 * Middleware: Requires admin role
 */
export async function requireAdmin(req, res, next) {
  const decoded = await authenticate(req, res);
  if (!decoded) return;
  if (enforcePasswordChange(decoded, req, res)) return;
  if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
    logSecurityEvent('ACCESS_DENIED', { username: decoded.username, role: decoded.role, required: 'admin', path: req.path }, req.ip);
    return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
  }
  req.user = decoded;
  return next();
}

/**
 * Middleware: Requires superadmin role
 */
export async function requireSuperadmin(req, res, next) {
  const decoded = await authenticate(req, res);
  if (!decoded) return;
  if (enforcePasswordChange(decoded, req, res)) return;
  if (decoded.role !== 'superadmin') {
    logSecurityEvent('ACCESS_DENIED', { username: decoded.username, role: decoded.role, required: 'superadmin', path: req.path }, req.ip);
    return res.status(403).json({ error: 'Forbidden', message: 'Superadmin access required' });
  }
  req.user = decoded;
  return next();
}

/**
 * Factory: Create middleware that requires access to a specific module.
 * Admin/Superadmin always have access to all modules.
 */
export function requireModuleAccess(moduleKey) {
  return async (req, res, next) => {
    const decoded = await authenticate(req, res);
    if (!decoded) return;
    if (enforcePasswordChange(decoded, req, res)) return;
    if (!hasModuleAccess(decoded, moduleKey)) {
      logSecurityEvent('ACCESS_DENIED', { username: decoded.username, role: decoded.role, required: moduleKey, path: req.path }, req.ip);
      return res.status(403).json({ error: 'Forbidden', message: `${moduleKey} access required` });
    }
    req.user = decoded;
    return next();
  };
}

/** Alias für requireModuleAccess('beratungslehrer') */
export const requireBeratungslehrer = requireModuleAccess('beratungslehrer');

/**
 * Check if a user has admin access for a specific module.
 * Full admins and superadmins always have access.
 * Module-admins have access via user_admin_access table.
 */
export function hasAdminAccess(user, moduleKey) {
  if (user.role === 'admin' || user.role === 'superadmin') return true;
  return Array.isArray(user.adminModules) && user.adminModules.includes(moduleKey);
}

/**
 * Factory: Create middleware that requires admin access for a specific module.
 * Checks user_admin_access table OR role=admin/superadmin.
 */
export function requireModuleAdmin(moduleKey) {
  return async (req, res, next) => {
    const decoded = await authenticate(req, res);
    if (!decoded) return;
    if (enforcePasswordChange(decoded, req, res)) return;

    // Full admins / superadmins always pass
    if (decoded.role === 'admin' || decoded.role === 'superadmin') {
      req.user = decoded;
      return next();
    }

    // Check user_admin_access for module-specific admin rights
    try {
      const { rows } = await query(
        'SELECT 1 FROM user_admin_access WHERE user_id = $1 AND module_key = $2',
        [decoded.id, moduleKey]
      );
      if (rows.length > 0) {
        req.user = decoded;
        return next();
      }
    } catch (err) {
      logger.error({ err, userId: decoded.id, moduleKey }, 'Module admin access check failed');
      return res.status(503).json({ error: 'Service Unavailable', message: 'Berechtigungsprüfung vorübergehend nicht möglich' });
    }

    logSecurityEvent('ACCESS_DENIED', { username: decoded.username, role: decoded.role, required: `admin:${moduleKey}`, path: req.path }, req.ip);
    return res.status(403).json({ error: 'Forbidden', message: `Admin-Zugang für ${moduleKey} erforderlich` });
  };
}

/**
 * Verify login credentials
 */
export async function verifyCredentials(username, password) {
  if (!ADMIN_USER) return false;
  if (username !== ADMIN_USER.username) return false;
  return bcrypt.compare(password, ADMIN_USER.passwordHash);
}
