import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Admin User Credentials
export const ADMIN_USER = {
  username: 'admin',
  passwordHash: '$2b$10$K7KzIVafYIWYoOIIXB2tTeBmrC16USa2HRzx22cC985UDuRKcDpWS' // bksb2024
};

const JWT_SECRET = process.env.JWT_SECRET || 'bksb-jwt-secret-2024-change-in-production';
const JWT_EXPIRES_IN = '8h';

/**
 * Generate JWT token for user
 */
export function generateToken(user) {
  const payload = { username: user.username, role: user.role };
  if (user.teacherId) {
    payload.teacherId = user.teacherId;
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
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
 * Middleware: Requires authenticated token
 * Checks Authorization header for valid JWT token
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication required' 
    });
  }

  const token = authHeader.substring(7);
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
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication required' 
    });
  }

  const token = authHeader.substring(7);
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
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }

  const token = authHeader.substring(7);
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
