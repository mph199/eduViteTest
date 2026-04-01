/**
 * Public Misc Routes
 *
 * GET /api/health — DB health check
 * GET /api/dev/email/last — Last email debug info (Ethereal only)
 */

import express from 'express';
import { sql } from 'kysely';
import { db } from '../../../../db/database.js';
import { getLastEmailDebugInfo } from '../../../../config/email.js';
import logger from '../../../../config/logger.js';

const router = express.Router();

router.get('/dev/email/last', (req, res) => {
  const transport = (process.env.MAIL_TRANSPORT || '').trim().toLowerCase();
  const allow = transport === 'ethereal' && process.env.NODE_ENV !== 'production';
  if (!allow) return res.status(404).json({ error: 'Not found' });
  return res.json({ email: getLastEmailDebugInfo() });
});

router.get('/health', async (_req, res) => {
  try {
    await sql`SELECT 1`.execute(db);
    res.json({ status: 'ok' });
  } catch (error) {
    logger.error({ err: error }, 'Health check failed');
    res.status(503).json({ status: 'error', error: 'Database connection failed' });
  }
});

export default router;
