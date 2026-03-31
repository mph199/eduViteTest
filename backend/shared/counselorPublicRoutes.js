/**
 * Shared Counselor Public Routes Factory
 *
 * Creates an Express router with standard public endpoints:
 * - GET /counselors
 * - GET /appointments/:counselorId?date=YYYY-MM-DD
 * - POST /appointments/:id/book
 *
 * @param {object} service         – Service created by createCounselorService()
 * @param {object} config
 * @param {string} config.counselorLabel    – for error messages
 * @param {object} [config.bookingLimiter]  – optional stricter rate limiter for POST /book
 */

import express from 'express';
import { createRateLimiter } from '../config/rateLimiter.js';
import { db } from '../db/database.js';
import { sql } from 'kysely';

import { assertSafeIdentifier } from './sqlGuards.js';
import { validate } from '../middleware/validate.js';
import { counselorBookingSchema } from '../schemas/counselor.js';
import logger from '../config/logger.js';

// Default booking limiter: stricter than general public limiter
const defaultBookingLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Buchungsversuche. Bitte spaeter erneut versuchen.' },
});

export function createCounselorPublicRoutes(service, config) {
  const {
    tablePrefix,
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
      const { first_name, last_name, student_class, email, phone, consent_version } = body;

      // Phone validation: allow digits, spaces, +, -, (, ) only
      const sanitizedPhone = phone ? String(phone).replace(/[^\d\s+\-()]/g, '').slice(0, 30) : null;

      const bookingData = {
        first_name,
        last_name,
        student_class,
        email,
        phone: sanitizedPhone,
      };

      // Determine if this counselor requires manual confirmation
      const appointmentsTable = `${tablePrefix}_appointments`;
      const counselorsTable = `${tablePrefix}_counselors`;

      const { rows: apptRows } = await sql`
        SELECT a.counselor_id, c.requires_confirmation
        FROM ${sql.table(appointmentsTable)} a
        JOIN ${sql.table(counselorsTable)} c ON c.id = a.counselor_id
        WHERE a.id = ${appointmentId} AND a.status = 'available'
      `.execute(db);

      const apptRow = apptRows[0];
      if (!apptRow) return res.status(409).json({ error: 'Termin nicht mehr verfügbar' });

      const requiresConfirmation = apptRow.requires_confirmation !== false;
      const appointment = await service.bookAppointment(appointmentId, bookingData, requiresConfirmation);

      // Consent-Receipt (append-only, Art. 7 Abs. 1)
      await db.insertInto('consent_receipts')
        .values({
          module: moduleName,
          appointment_id: appointment.id,
          consent_version: String(consent_version).slice(0, 20),
          consent_purpose: 'Terminbuchung und Kontaktaufnahme',
          ip_address: req.ip || null,
          user_agent: req.get('user-agent') || null,
        })
        .execute();

      res.json({ success: true, appointment });
    } catch (err) {
      const status = err.statusCode || 500;
      if (status >= 500) logger.error({ err }, 'Public: Fehler beim Buchen');
      res.status(status).json({ error: status < 500 ? (err.message || 'Fehler beim Buchen') : 'Fehler beim Buchen' });
    }
  });

  return router;
}
