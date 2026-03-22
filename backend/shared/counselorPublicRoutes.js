/**
 * Shared Counselor Public Routes Factory
 *
 * Creates an Express router with standard public endpoints:
 * - GET /counselors
 * - GET /categories or /topics (configurable)
 * - GET /appointments/:counselorId?date=YYYY-MM-DD
 * - POST /appointments/:id/book
 *
 * @param {object} service         – Service created by createCounselorService()
 * @param {object} config
 * @param {string} config.topicForeignKey   – 'category_id' or 'topic_id'
 * @param {string} config.topicEndpoint     – '/categories' or '/topics'
 * @param {string} config.topicResponseKey  – 'categories' or 'topics'
 * @param {string} config.counselorLabel    – for error messages
 * @param {object} [config.bookingLimiter]  – optional stricter rate limiter for POST /book
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../config/db.js';
import { assertSafeIdentifier } from './sqlGuards.js';
import { validate } from '../middleware/validate.js';
import { counselorBookingSchema } from '../schemas/counselor.js';
import logger from '../config/logger.js';

// Default booking limiter: stricter than general public limiter
const defaultBookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Buchungsversuche. Bitte spaeter erneut versuchen.' },
});

export function createCounselorPublicRoutes(service, config) {
  const {
    tablePrefix,
    topicForeignKey,
    topicEndpoint,
    topicResponseKey,
    counselorLabel = 'Berater/in',
    moduleName = 'unknown',
    bookingLimiter = defaultBookingLimiter,
  } = config;

  assertSafeIdentifier(tablePrefix, 'tablePrefix');

  const router = express.Router();

  // GET /counselors
  router.get('/counselors', async (_req, res) => {
    try {
      const counselors = await service.listCounselors();
      res.json({ counselors });
    } catch (err) {
      logger.error({ err }, `Public: Fehler beim Laden der ${counselorLabel}`);
      res.status(500).json({ error: `Fehler beim Laden der ${counselorLabel}` });
    }
  });

  // GET /categories or /topics
  router.get(topicEndpoint, async (_req, res) => {
    try {
      const items = await service.listTopics();
      res.json({ [topicResponseKey]: items });
    } catch (err) {
      logger.error({ err }, `Public: Fehler beim Laden der ${topicResponseKey}`);
      res.status(500).json({ error: `Fehler beim Laden der ${topicResponseKey}` });
    }
  });

  // GET /appointments/:counselorId?date=YYYY-MM-DD
  router.get('/appointments/:counselorId', async (req, res) => {
    try {
      const counselorId = parseInt(req.params.counselorId, 10);
      if (isNaN(counselorId)) return res.status(400).json({ error: 'Ungueltige Berater-ID' });

      const date = req.query.date;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
        return res.status(400).json({ error: 'Datum im Format YYYY-MM-DD erforderlich' });
      }

      const appointments = await service.getAvailableAppointments(counselorId, date);
      res.json({ appointments });
    } catch (err) {
      const status = err.statusCode || 500;
      if (status >= 500) logger.error({ err }, 'Public: Fehler beim Laden der Termine');
      res.status(status).json({ error: status < 500 ? (err.message || 'Fehler beim Laden der Termine') : 'Fehler beim Laden der Termine' });
    }
  });

  // POST /appointments/:id/book (stricter rate limit for write operations)
  router.post('/appointments/:id/book', bookingLimiter, validate(counselorBookingSchema), async (req, res) => {
    try {
      const appointmentId = parseInt(req.params.id, 10);
      if (isNaN(appointmentId)) return res.status(400).json({ error: 'Ungueltige Termin-ID' });

      const body = req.body;
      const { student_name, student_class, email, phone, is_urgent, consent_version } = body;

      const bookingData = {
        student_name,
        student_class,
        email,
        phone,
        [topicForeignKey]: body[topicForeignKey] ? parseInt(body[topicForeignKey], 10) : null,
        is_urgent,
      };

      // Determine if this counselor requires manual confirmation
      const appointmentsTable = `${tablePrefix}_appointments`;
      const counselorsTable = `${tablePrefix}_counselors`;
      const { rows: [apptRow] } = await query(
        `SELECT a.counselor_id, c.requires_confirmation
         FROM ${appointmentsTable} a
         JOIN ${counselorsTable} c ON c.id = a.counselor_id
         WHERE a.id = $1 AND a.status = 'available'`,
        [appointmentId]
      );
      if (!apptRow) return res.status(409).json({ error: 'Termin nicht mehr verfügbar' });

      const requiresConfirmation = apptRow.requires_confirmation !== false;
      const appointment = await service.bookAppointment(appointmentId, bookingData, requiresConfirmation);

      // Consent-Receipt (append-only, Art. 7 Abs. 1)
      await query(
        `INSERT INTO consent_receipts (module, appointment_id, consent_version, consent_purpose, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          moduleName,
          appointment.id,
          String(consent_version).slice(0, 20),
          'Terminbuchung und Kontaktaufnahme',
          req.ip || null,
          req.get('user-agent') || null,
        ]
      );

      res.json({ success: true, appointment });
    } catch (err) {
      const status = err.statusCode || 500;
      if (status >= 500) logger.error({ err }, 'Public: Fehler beim Buchen');
      res.status(status).json({ error: status < 500 ? (err.message || 'Fehler beim Buchen') : 'Fehler beim Buchen' });
    }
  });

  return router;
}
