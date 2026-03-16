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

export function createCounselorPublicRoutes(service, config) {
  const {
    topicForeignKey,
    topicEndpoint,
    topicResponseKey,
    counselorLabel = 'Berater/in',
  } = config;

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
      const { student_name, student_class, email, phone, concern, is_urgent } = body;

      if (!student_name || !String(student_name).trim()) {
        return res.status(400).json({ error: 'Name ist erforderlich' });
      }

      const bookingData = {
        student_name: String(student_name).trim(),
        student_class: student_class ? String(student_class).trim() : null,
        email: email ? String(email).trim().toLowerCase() : null,
        phone: phone ? String(phone).trim() : null,
        concern: concern ? String(concern).trim() : null,
        [topicForeignKey]: body[topicForeignKey] ? parseInt(body[topicForeignKey], 10) : null,
        is_urgent: !!is_urgent,
      };

      const appointment = await service.bookAppointment(appointmentId, bookingData);
      res.json({ success: true, appointment });
    } catch (err) {
      const status = err.statusCode || 500;
      res.status(status).json({ error: err.message || 'Fehler beim Buchen' });
    }
  });

  return router;
}
