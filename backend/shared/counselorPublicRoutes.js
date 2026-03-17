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
 */

import express from 'express';
import { query } from '../config/db.js';

/** Validates that a string is a safe SQL identifier (lowercase letters, digits, underscores). */
const SAFE_IDENTIFIER = /^[a-z][a-z0-9_]*$/;
function assertSafeIdentifier(value, label) {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new Error(`Invalid SQL identifier for ${label}: "${value}"`);
  }
}

export function createCounselorPublicRoutes(service, config) {
  const {
    tablePrefix,
    topicForeignKey,
    topicEndpoint,
    topicResponseKey,
    counselorLabel = 'Berater/in',
    moduleName = 'unknown',
  } = config;

  assertSafeIdentifier(tablePrefix, 'tablePrefix');

  const router = express.Router();

  // GET /counselors
  router.get('/counselors', async (_req, res) => {
    try {
      const counselors = await service.listCounselors();
      res.json({ counselors });
    } catch (err) {
      res.status(500).json({ error: `Fehler beim Laden der ${counselorLabel}` });
    }
  });

  // GET /categories or /topics
  router.get(topicEndpoint, async (_req, res) => {
    try {
      const items = await service.listTopics();
      res.json({ [topicResponseKey]: items });
    } catch (err) {
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
      res.status(status).json({ error: err.message || 'Fehler beim Laden der Termine' });
    }
  });

  // POST /appointments/:id/book
  router.post('/appointments/:id/book', async (req, res) => {
    try {
      const appointmentId = parseInt(req.params.id, 10);
      if (isNaN(appointmentId)) return res.status(400).json({ error: 'Ungueltige Termin-ID' });

      const body = req.body || {};
      const { student_name, student_class, email, phone, is_urgent, consent_version } = body;

      if (!student_name || !String(student_name).trim()) {
        return res.status(400).json({ error: 'Name ist erforderlich' });
      }
      if (!consent_version) {
        return res.status(400).json({ error: 'Einwilligung ist erforderlich' });
      }
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email).trim())) {
        return res.status(400).json({ error: 'Ungueltiges E-Mail-Format' });
      }

      const bookingData = {
        student_name: String(student_name).trim().slice(0, 255),
        student_class: student_class ? String(student_class).trim().slice(0, 50) : null,
        email: email ? String(email).trim().toLowerCase().slice(0, 254) : null,
        phone: phone ? String(phone).trim().slice(0, 50) : null,
        [topicForeignKey]: body[topicForeignKey] ? parseInt(body[topicForeignKey], 10) : null,
        is_urgent: !!is_urgent,
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
      res.status(status).json({ error: err.message || 'Fehler beim Buchen' });
    }
  });

  return router;
}
