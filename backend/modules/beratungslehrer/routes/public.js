/**
 * Beratungslehrer – Oeffentliche Routen
 *
 * Endpunkte fuer Schueler/innen zum Anzeigen von Beratungslehrern,
 * Themen, verfuegbaren Terminen, Buchen und anonymen Anfragen.
 */

import express from 'express';
import {
  listCounselors,
  listTopics,
  getAvailableAppointments,
  bookAppointment,
  createRequest,
  getRequestByToken,
} from '../services/appointmentService.js';

const router = express.Router();

// GET /api/bl/counselors — list active counselors
router.get('/counselors', async (_req, res) => {
  try {
    const counselors = await listCounselors();
    res.json({ counselors });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Beratungslehrer' });
  }
});

// GET /api/bl/topics — list topics
router.get('/topics', async (_req, res) => {
  try {
    const topics = await listTopics();
    res.json({ topics });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Themen' });
  }
});

// GET /api/bl/appointments/:counselorId?date=YYYY-MM-DD — available slots
router.get('/appointments/:counselorId', async (req, res) => {
  try {
    const counselorId = parseInt(req.params.counselorId, 10);
    if (isNaN(counselorId)) return res.status(400).json({ error: 'Ungueltige Berater-ID' });

    const date = req.query.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ error: 'Datum im Format YYYY-MM-DD erforderlich' });
    }

    const appointments = await getAvailableAppointments(counselorId, date);
    res.json({ appointments });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Fehler beim Laden der Termine' });
  }
});

// POST /api/bl/appointments/:id/book — book an appointment (supports anonymous)
router.post('/appointments/:id/book', async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id, 10);
    if (isNaN(appointmentId)) return res.status(400).json({ error: 'Ungueltige Termin-ID' });

    const { student_name, student_class, email, phone, concern, topic_id, is_urgent, is_anonymous } = req.body || {};

    // Name is required unless booking anonymously
    if (!is_anonymous && (!student_name || !String(student_name).trim())) {
      return res.status(400).json({ error: 'Name ist erforderlich (oder anonym buchen)' });
    }

    const appointment = await bookAppointment(appointmentId, {
      student_name: student_name ? String(student_name).trim() : null,
      student_class: student_class ? String(student_class).trim() : null,
      email: email ? String(email).trim().toLowerCase() : null,
      phone: phone ? String(phone).trim() : null,
      concern: concern ? String(concern).trim() : null,
      topic_id: topic_id ? parseInt(topic_id, 10) : null,
      is_urgent: !!is_urgent,
      is_anonymous: !!is_anonymous,
    });

    res.json({ success: true, appointment });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Fehler beim Buchen' });
  }
});

// POST /api/bl/requests — create an anonymous request
router.post('/requests', async (req, res) => {
  try {
    const { counselor_id, topic_id, message, contact_method, contact_info, is_urgent } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Nachricht ist erforderlich' });
    }

    if (contact_method === 'email' && (!contact_info || !String(contact_info).trim())) {
      return res.status(400).json({ error: 'E-Mail-Adresse ist erforderlich bei Kontakt per E-Mail' });
    }

    const request = await createRequest({
      counselor_id: counselor_id ? parseInt(counselor_id, 10) : null,
      topic_id: topic_id ? parseInt(topic_id, 10) : null,
      message: String(message).trim(),
      contact_method: contact_method || 'none',
      contact_info: contact_info ? String(contact_info).trim() : null,
      is_urgent: !!is_urgent,
    });

    res.json({ success: true, access_token: request.access_token });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Fehler beim Absenden der Anfrage' });
  }
});

// GET /api/bl/requests/status/:token — check request status by token
router.get('/requests/status/:token', async (req, res) => {
  try {
    const token = req.params.token;
    if (!token || token.length !== 64) {
      return res.status(400).json({ error: 'Ungueltiger Token' });
    }

    const request = await getRequestByToken(token);
    res.json({ request });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Fehler beim Laden des Status' });
  }
});

export default router;
