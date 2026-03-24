/**
 * Token-Management für Kalender-Abos.
 *
 * GET    /api/teacher/calendar-token          → Status
 * POST   /api/teacher/calendar-token          → Erstellen (409 bei aktivem Token)
 * POST   /api/teacher/calendar-token/rotate   → Rotieren
 * DELETE /api/teacher/calendar-token          → Widerrufen
 */

import express from 'express';
import crypto from 'crypto';
import { requireAuth } from '../../../../middleware/auth.js';
import { query } from '../../../../config/db.js';
import logger from '../../../../config/logger.js';
import { requireTeacher } from './lib/middleware.js';
import { getExpiresAt } from '../../utils/tokenUtils.js';

const router = express.Router();

/**
 * Erzeugt ein neues Token und speichert den Hash.
 */
async function createNewToken(teacherId) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const now = new Date();

  await query(
    `UPDATE teachers
     SET calendar_token_hash = $1, calendar_token_created_at = $2
     WHERE id = $3`,
    [tokenHash, now.toISOString(), teacherId]
  );

  const expiresAt = getExpiresAt(now);
  return { token: rawToken, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() };
}

/**
 * GET /api/teacher/calendar-token
 * Gibt Token-Status zurück (nie den Token selbst).
 */
router.get('/calendar-token', requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const { rows } = await query(
      `SELECT calendar_token_hash IS NOT NULL AS has_token,
              calendar_token_created_at
       FROM teachers
       WHERE id = $1`,
      [teacherId]
    );

    const row = rows[0];
    if (!row || !row.has_token) {
      return res.json({ exists: false });
    }

    const createdAt = row.calendar_token_created_at;
    const expiresAt = getExpiresAt(createdAt);
    const isExpired = new Date() > expiresAt;

    // Abgelaufenes Token gilt logisch als nicht aktiv
    if (isExpired) {
      return res.json({
        exists: false,
        expired: true,
        createdAt,
        expiresAt: expiresAt.toISOString(),
        isExpired: true,
      });
    }

    return res.json({
      exists: true,
      createdAt,
      expiresAt: expiresAt.toISOString(),
      isExpired: false,
    });
  } catch (err) {
    logger.error({ err }, 'Fehler beim Abfragen des Kalender-Token-Status');
    return res.status(500).json({ error: 'Interner Fehler' });
  }
});

/**
 * POST /api/teacher/calendar-token
 * Erstellt ein neues Token. 409 nur bei aktivem (nicht abgelaufenem) Token.
 */
router.post('/calendar-token', requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    // Prüfen ob aktives Token existiert
    const { rows } = await query(
      `SELECT calendar_token_hash IS NOT NULL AS has_token,
              calendar_token_created_at
       FROM teachers
       WHERE id = $1`,
      [teacherId]
    );

    const row = rows[0];
    if (row?.has_token) {
      const expiresAt = getExpiresAt(row.calendar_token_created_at);
      if (new Date() <= expiresAt) {
        return res.status(409).json({ error: 'Aktives Kalender-Abo existiert bereits. Nutzen Sie Rotation oder Löschung.' });
      }
      // Abgelaufen → neues erstellen erlaubt
    }

    const result = await createNewToken(teacherId);
    logger.info({ teacherId }, 'Kalender-Token erstellt');
    return res.status(201).json(result);
  } catch (err) {
    logger.error({ err }, 'Fehler beim Erstellen des Kalender-Tokens');
    return res.status(500).json({ error: 'Interner Fehler' });
  }
});

/**
 * POST /api/teacher/calendar-token/rotate
 * Rotiert Token: altes sofort ungültig, neues erzeugt.
 */
router.post('/calendar-token/rotate', requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const result = await createNewToken(teacherId);
    logger.info({ teacherId }, 'Kalender-Token rotiert');
    return res.status(200).json(result);
  } catch (err) {
    logger.error({ err }, 'Fehler beim Rotieren des Kalender-Tokens');
    return res.status(500).json({ error: 'Interner Fehler' });
  }
});

/**
 * DELETE /api/teacher/calendar-token
 * Widerruft Token.
 */
router.delete('/calendar-token', requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    await query(
      `UPDATE teachers
       SET calendar_token_hash = NULL, calendar_token_created_at = NULL
       WHERE id = $1`,
      [teacherId]
    );

    logger.info({ teacherId }, 'Kalender-Token widerrufen');
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Fehler beim Widerrufen des Kalender-Tokens');
    return res.status(500).json({ error: 'Interner Fehler' });
  }
});

export default router;
