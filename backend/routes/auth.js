import express from 'express';
import { verifyCredentials, ADMIN_USER } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Sets session on success
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ 
      error: 'Bad Request', 
      message: 'Username and password required' 
    });
  }

  const isValid = await verifyCredentials(username, password);
  
  if (!isValid) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid credentials' 
    });
  }

  // Set session
  req.session.isAuthenticated = true;
  req.session.user = { username: ADMIN_USER.username };

  res.json({ 
    success: true, 
    message: 'Login successful',
    user: { username: ADMIN_USER.username }
  });
});

/**
 * POST /api/auth/logout
 * Destroys session
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Logout failed' 
      });
    }
    res.clearCookie('connect.sid');
    res.json({ 
      success: true, 
      message: 'Logout successful' 
    });
  });
});

/**
 * GET /api/auth/verify
 * Checks if session is authenticated
 */
router.get('/verify', (req, res) => {
  if (req.session && req.session.isAuthenticated) {
    return res.json({ 
      authenticated: true, 
      user: req.session.user || { username: ADMIN_USER.username }
    });
  }
  res.json({ 
    authenticated: false 
  });
});

export default router;
