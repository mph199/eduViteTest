/**
 * Schulsozialarbeit – Öffentliche Routen
 *
 * Endpunkte für Schüler/innen zum Anzeigen von Beratern,
 * Kategorien, verfügbaren Terminen und zum Buchen.
 */

import express from 'express';
import {
  listCounselors,
  listCategories,
  getAvailableAppointments,
  bookAppointment,
} from '../services/appointmentService.js';

const router = express.Router();

// GET /api/ssw/counselors — list active counselors
router.get('/counselors', async (_req, res) => {
  try {
    const counselors = await listCounselors();
    res.json({ counselors });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Berater/innen' });
  }
});

// GET /api/ssw/categories — list appointment categories
router.get('/categories', async (_req, res) => {
  try {
    const categories = await listCategories();
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
  }
});

// GET /api/ssw/appointments/:counselorId?date=YYYY-MM-DD — available slots
router.get('/appointments/:counselorId', async (req, res) => {
  try {
    const counselorId = parseInt(req.params.counselorId, 10);
    if (isNaN(counselorId)) return res.status(400).json({ error: 'Ungültige Berater-ID' });

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

// POST /api/ssw/appointments/:id/book — book an appointment
router.post('/appointments/:id/book', async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id, 10);
    if (isNaN(appointmentId)) return res.status(400).json({ error: 'Ungültige Termin-ID' });

    const { student_name, student_class, email, phone, concern, category_id, is_urgent } = req.body || {};

    if (!student_name || !String(student_name).trim()) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }

    const appointment = await bookAppointment(appointmentId, {
      student_name: String(student_name).trim(),
      student_class: student_class ? String(student_class).trim() : null,
      email: email ? String(email).trim().toLowerCase() : null,
      phone: phone ? String(phone).trim() : null,
      concern: concern ? String(concern).trim() : null,
      category_id: category_id ? parseInt(category_id, 10) : null,
      is_urgent: !!is_urgent,
    });

    res.json({ success: true, appointment });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Fehler beim Buchen' });
  }
});

export default router;
