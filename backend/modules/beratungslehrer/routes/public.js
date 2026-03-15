/**
 * Beratungslehrer – Oeffentliche Routen
 *
 * Endpunkte fuer Schueler/innen zum Anzeigen von Beratungslehrern,
 * Themen, verfuegbaren Terminen und Buchen.
 */

import express from 'express';
import {
  listCounselors,
  listTopics,
  getAvailableAppointments,
  bookAppointment,
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

// POST /api/bl/appointments/:id/book — book an appointment
router.post('/appointments/:id/book', async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id, 10);
    if (isNaN(appointmentId)) return res.status(400).json({ error: 'Ungueltige Termin-ID' });

    const { student_name, student_class, email, phone, concern, topic_id, is_urgent } = req.body || {};

    if (!student_name || !String(student_name).trim()) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }

    const appointment = await bookAppointment(appointmentId, {
      student_name: String(student_name).trim(),
      student_class: student_class ? String(student_class).trim() : null,
      email: email ? String(email).trim().toLowerCase() : null,
      phone: phone ? String(phone).trim() : null,
      concern: concern ? String(concern).trim() : null,
      topic_id: topic_id ? parseInt(topic_id, 10) : null,
      is_urgent: !!is_urgent,
    });

    res.json({ success: true, appointment });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Fehler beim Buchen' });
  }
});

export default router;
