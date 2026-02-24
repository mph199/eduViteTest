import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { verifyCredentials, ADMIN_USER, generateToken, verifyToken } from '../middleware/auth.js';

const router = express.Router();

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
    // 1) Harte Admin-Creds
    const isValidAdmin = await verifyCredentials(username, password);
    if (isValidAdmin) {
      const user = { username: ADMIN_USER.username, role: 'admin' };
      const token = generateToken(user);
      console.log('Admin login successful');
      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user
      });
    }

    // 2) DB-User (teacher / user)
    const { rows: users } = await query(
      'SELECT id, username, role, password_hash, teacher_id FROM users WHERE username = $1 LIMIT 1',
      [username]
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
    const role = dbUser.role === 'teacher' ? 'teacher' : (dbUser.role === 'admin' ? 'admin' : 'user');

    const user = {
      username: dbUser.username,
      role,
      teacherId: dbUser.teacher_id || undefined
    };
    const token = generateToken(user);

    // Verwendung einfacher Strings statt Template-Literals, um Heredoc-/Encoding-Issues zu vermeiden
    console.log('DB login successful:', dbUser.username, '(' + role + ')');

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user
    });
  } catch (err) {
    console.error('Login error:', err);
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
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Optional: accept DELETE for clients using DELETE /logout
router.delete('/logout', (_req, res) => {
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
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ authenticated: false });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    user: {
      username: decoded.username,
      role: decoded.role,
      teacherId: decoded.teacherId
    }
  });
});

export default router;
