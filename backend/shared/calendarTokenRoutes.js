/**
 * Shared Calendar-Token-Router-Factory für Counselor-Module.
 *
 * Erzeugt GET/POST/POST rotate/DELETE Endpunkte für Kalender-Abo-Token.
 * Wird in den jeweiligen counselor.js-Routern der Module gemountet.
 *
 * @param {Object} config
 * @param {string} config.table - Counselor-Tabelle (z.B. "bl_counselors")
 * @param {string} config.logPrefix - Log-Prefix (z.B. "BL")
 * @param {Function} config.resolveCounselorId - async (req) => counselorId | null
 */

import express from 'express';
import crypto from 'crypto';
import { query } from '../config/db.js';

import logger from '../config/logger.js';
import { getExpiresAt } from './tokenUtils.js';
import { assertSafeIdentifier } from './sqlGuards.js';

export function createCalendarTokenRoutes(config) {
  const { table, logPrefix, resolveCounselorId } = config;

  assertSafeIdentifier(table, 'table');

  const router = express.Router();

  async function createNewToken(counselorId) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();

    await query(
      `UPDATE ${table}
       SET calendar_token_hash = $1, calendar_token_created_at = $2
       WHERE id = $3`,
      [tokenHash, now.toISOString(), counselorId]
    );

    const expiresAt = getExpiresAt(now);
    return { token: rawToken, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() };
  }

  // GET /calendar-token
  router.get('/calendar-token', async (req, res) => {
    try {
      const counselorId = await resolveCounselorId(req);
      if (!counselorId) return res.status(403).json({ error: 'Kein Berater-Zugang' });

      const { rows } = await query(
        `SELECT calendar_token_hash IS NOT NULL AS has_token,
                calendar_token_created_at
         FROM ${table}
         WHERE id = $1`,
        [counselorId]
      );

      const row = rows[0];
      if (!row || !row.has_token) {
        return res.json({ exists: false });
      }

      const createdAt = row.calendar_token_created_at;
      const expiresAt = getExpiresAt(createdAt);
      const isExpired = new Date() > expiresAt;

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
      logger.error({ err }, `${logPrefix}: Fehler beim Abfragen des Kalender-Token-Status`);
      return res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // POST /calendar-token
  router.post('/calendar-token', async (req, res) => {
    try {
      const counselorId = await resolveCounselorId(req);
      if (!counselorId) return res.status(403).json({ error: 'Kein Berater-Zugang' });

      const { rows } = await query(
        `SELECT calendar_token_hash IS NOT NULL AS has_token,
                calendar_token_created_at
         FROM ${table}
         WHERE id = $1`,
        [counselorId]
      );

      const row = rows[0];
      if (row?.has_token) {
        const expiresAt = getExpiresAt(row.calendar_token_created_at);
        if (new Date() <= expiresAt) {
          return res.status(409).json({ error: 'Aktives Kalender-Abo existiert bereits. Nutzen Sie Rotation oder Widerruf.' });
        }
      }

      const result = await createNewToken(counselorId);
      logger.info({ counselorId, table }, `${logPrefix}: Kalender-Token erstellt`);
      return res.status(201).json(result);
    } catch (err) {
      logger.error({ err }, `${logPrefix}: Fehler beim Erstellen des Kalender-Tokens`);
      return res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // POST /calendar-token/rotate
  router.post('/calendar-token/rotate', async (req, res) => {
    try {
      const counselorId = await resolveCounselorId(req);
      if (!counselorId) return res.status(403).json({ error: 'Kein Berater-Zugang' });

      const result = await createNewToken(counselorId);
      logger.info({ counselorId, table }, `${logPrefix}: Kalender-Token rotiert`);
      return res.status(200).json(result);
    } catch (err) {
      logger.error({ err }, `${logPrefix}: Fehler beim Rotieren des Kalender-Tokens`);
      return res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  // DELETE /calendar-token
  router.delete('/calendar-token', async (req, res) => {
    try {
      const counselorId = await resolveCounselorId(req);
      if (!counselorId) return res.status(403).json({ error: 'Kein Berater-Zugang' });

      await query(
        `UPDATE ${table}
         SET calendar_token_hash = NULL, calendar_token_created_at = NULL
         WHERE id = $1`,
        [counselorId]
      );

      logger.info({ counselorId, table }, `${logPrefix}: Kalender-Token widerrufen`);
      return res.json({ success: true });
    } catch (err) {
      logger.error({ err }, `${logPrefix}: Fehler beim Widerrufen des Kalender-Tokens`);
      return res.status(500).json({ error: 'Interner Fehler' });
    }
  });

  return router;
}
