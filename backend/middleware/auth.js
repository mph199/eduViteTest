import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Admin User Credentials
export const ADMIN_USER = {
  username: 'Start',
  passwordHash: '$2b$10$jMMKjGTA.VRvbHHcoWAlhexrOd29f89oVG7wdk..iKtXxMcCWGeYa' // Start
};

const JWT_SECRET = process.env.JWT_SECRET || 'bksb-jwt-secret-2024-change-in-production';
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
 * Extract token from Authorization header or cookie.
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  if (req.cookies?.token) {
    return req.cookies.token;
  }
  return null;
}

/**
 * Shared authentication logic for all middleware.
 * Returns decoded token or sends error response.
 */
function authenticate(req, res) {
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
  return decoded;
}

/**
 * Middleware: Requires authenticated token
 */
export function requireAuth(req, res, next) {
  const decoded = authenticate(req, res);
  if (!decoded) return;
  req.user = decoded;
  return next();
}

/**
 * Middleware: Requires admin role
 */
export function requireAdmin(req, res, next) {
  const decoded = authenticate(req, res);
  if (!decoded) return;
  if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
  }
  req.user = decoded;
  return next();
}

/**
 * Middleware: Requires superadmin role
 */
export function requireSuperadmin(req, res, next) {
  const decoded = authenticate(req, res);
  if (!decoded) return;
  if (decoded.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Superadmin access required' });
  }
  req.user = decoded;
  return next();
}

/**
 * Middleware: Requires SSW access (role ssw, admin, or superadmin)
 */
export function requireSSW(req, res, next) {
  const decoded = authenticate(req, res);
  if (!decoded) return;
  if (decoded.role !== 'admin' && decoded.role !== 'superadmin' && decoded.role !== 'ssw') {
    return res.status(403).json({ error: 'Forbidden', message: 'SSW access required' });
  }
  req.user = decoded;
  return next();
}

/**
 * Middleware: Requires Beratungslehrer access
 * Allows admin, superadmin, or users with 'beratungslehrer' module access.
 */
export function requireBeratungslehrer(req, res, next) {
  const decoded = authenticate(req, res);
  if (!decoded) return;
  if (!hasModuleAccess(decoded, 'beratungslehrer')) {
    return res.status(403).json({ error: 'Forbidden', message: 'Beratungslehrer access required' });
  }
  req.user = decoded;
  return next();
}

/**
 * Factory: Create middleware that requires access to a specific module.
 */
export function requireModuleAccess(moduleKey) {
  return (req, res, next) => {
    const decoded = authenticate(req, res);
    if (!decoded) return;
    if (!hasModuleAccess(decoded, moduleKey)) {
      return res.status(403).json({ error: 'Forbidden', message: `${moduleKey} access required` });
    }
    req.user = decoded;
    return next();
  };
}

/**
 * Verify login credentials
 */
export async function verifyCredentials(username, password) {
  if (username !== ADMIN_USER.username) {
    return false;
  }
  return bcrypt.compare(password, ADMIN_USER.passwordHash);
}
