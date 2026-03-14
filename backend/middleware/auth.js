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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Middleware: Requires Beratungslehrer role
 * Allows admin, superadmin, and beratungslehrer roles.
 */
export function requireBeratungslehrer(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
  if (decoded.role !== 'admin' && decoded.role !== 'superadmin' && decoded.role !== 'beratungslehrer') {
    return res.status(403).json({ error: 'Forbidden', message: 'Beratungslehrer access required' });
  }
  req.user = decoded;
  return next();
}

/**
 * Middleware: Requires SSW role (Schulsozialarbeit admin access)
 * Allows admin, superadmin, and ssw roles.
 */
export function requireSSW(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
  if (decoded.role !== 'admin' && decoded.role !== 'superadmin' && decoded.role !== 'ssw') {
    return res.status(403).json({ error: 'Forbidden', message: 'SSW access required' });
  }
  req.user = decoded;
  return next();
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
 * Middleware: Requires authenticated token
 * Checks Authorization header or cookie for valid JWT token
 */
export function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication required' 
    });
  }

  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid or expired token' 
    });
  }
  
  req.user = decoded;
  return next();
}

/**
 * Middleware: Requires admin role
 * Checks if user is authenticated AND has admin role
 */
export function requireAdmin(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication required' 
    });
  }

  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid or expired token' 
    });
  }
  
  if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Admin access required' 
    });
  }
  
  req.user = decoded;
  return next();
}

/**
 * Middleware: Requires superadmin role
 */
export function requireSuperadmin(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }

  if (decoded.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Superadmin access required' });
  }

  req.user = decoded;
  return next();
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
