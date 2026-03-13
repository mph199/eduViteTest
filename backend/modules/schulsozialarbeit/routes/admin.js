/**
 * Schulsozialarbeit – Admin-Routen
 *
 * Verwaltung von Berater/innen und Kategorien.
 */

import express from 'express';
import { requireAdmin } from '../../../middleware/auth.js';
import { query } from '../../../config/db.js';

const router = express.Router();

// ── Counselors CRUD ────────────────────────────────────────────────────

// GET /api/ssw/admin/counselors
router.get('/counselors', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM ssw_counselors ORDER BY last_name, first_name');
    res.json({ counselors: rows });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Berater/innen' });
  }
});

// POST /api/ssw/admin/counselors
router.post('/counselors', requireAdmin, async (req, res) => {
  try {
    const { first_name, last_name, email, salutation, room, phone, specializations,
            available_from, available_until, slot_duration_minutes } = req.body || {};

    if (!last_name?.trim()) return res.status(400).json({ error: 'Nachname ist erforderlich' });

    const { rows } = await query(
      `INSERT INTO ssw_counselors (first_name, last_name, email, salutation, room, phone,
       specializations, available_from, available_until, slot_duration_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        (first_name || '').trim(),
        last_name.trim(),
        email ? email.trim().toLowerCase() : null,
        salutation || null,
        room ? room.trim() : null,
        phone ? phone.trim() : null,
        specializations || null,
        available_from || '08:00',
        available_until || '14:00',
        slot_duration_minutes || 30,
      ]
    );

    res.json({ success: true, counselor: rows[0] });
  } catch (err) {
    console.error('SSW create counselor error:', err);
    res.status(500).json({ error: 'Fehler beim Anlegen' });
  }
});

// PUT /api/ssw/admin/counselors/:id
router.put('/counselors/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { first_name, last_name, email, salutation, room, phone, specializations,
            available_from, available_until, slot_duration_minutes, active } = req.body || {};

    if (!last_name?.trim()) return res.status(400).json({ error: 'Nachname ist erforderlich' });

    const { rows } = await query(
      `UPDATE ssw_counselors SET
         first_name = $1, last_name = $2, email = $3, salutation = $4,
         room = $5, phone = $6, specializations = $7,
         available_from = $8, available_until = $9,
         slot_duration_minutes = $10, active = $11
       WHERE id = $12 RETURNING *`,
      [
        (first_name || '').trim(),
        last_name.trim(),
        email ? email.trim().toLowerCase() : null,
        salutation || null,
        room ? room.trim() : null,
        phone ? phone.trim() : null,
        specializations || null,
        available_from || '08:00',
        available_until || '14:00',
        slot_duration_minutes || 30,
        active !== false,
        id,
      ]
    );

    if (!rows.length) return res.status(404).json({ error: 'Berater/in nicht gefunden' });
    res.json({ success: true, counselor: rows[0] });
  } catch (err) {
    console.error('SSW update counselor error:', err);
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// DELETE /api/ssw/admin/counselors/:id
router.delete('/counselors/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await query('DELETE FROM ssw_counselors WHERE id = $1 RETURNING id', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Berater/in nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    if (err?.code === '23503') {
      return res.status(409).json({ error: 'Berater/in hat noch Termine. Bitte zuerst Termine löschen oder Berater/in deaktivieren.' });
    }
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// ── Categories CRUD ────────────────────────────────────────────────────

// GET /api/ssw/admin/categories
router.get('/categories', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM ssw_categories ORDER BY sort_order, id');
    res.json({ categories: rows });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
  }
});

// POST /api/ssw/admin/categories
router.post('/categories', requireAdmin, async (req, res) => {
  try {
    const { name, description, icon, sort_order } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name ist erforderlich' });

    const { rows } = await query(
      'INSERT INTO ssw_categories (name, description, icon, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [name.trim(), description || null, icon || '💬', sort_order || 0]
    );
    res.json({ success: true, category: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Anlegen' });
  }
});

// PUT /api/ssw/admin/categories/:id
router.put('/categories/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description, icon, sort_order, active } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name ist erforderlich' });

    const { rows } = await query(
      'UPDATE ssw_categories SET name = $1, description = $2, icon = $3, sort_order = $4, active = $5 WHERE id = $6 RETURNING *',
      [name.trim(), description || null, icon || '💬', sort_order || 0, active !== false, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Kategorie nicht gefunden' });
    res.json({ success: true, category: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// ── Stats ──────────────────────────────────────────────────────────────

// GET /api/ssw/admin/stats
router.get('/stats', requireAdmin, async (_req, res) => {
  try {
    const { rows: [counts] } = await query(`
      SELECT
        (SELECT COUNT(*) FROM ssw_counselors WHERE active = TRUE) AS counselors,
        (SELECT COUNT(*) FROM ssw_appointments WHERE status = 'requested') AS pending,
        (SELECT COUNT(*) FROM ssw_appointments WHERE status = 'confirmed') AS confirmed,
        (SELECT COUNT(*) FROM ssw_appointments WHERE status = 'available' AND date >= CURRENT_DATE) AS available
    `);
    res.json({ stats: counts });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Statistiken' });
  }
});

// ── Appointments (calendar management) ─────────────────────────────────

// GET /api/ssw/admin/appointments?counselor_id=X&date_from=YYYY-MM-DD&date_until=YYYY-MM-DD
router.get('/appointments', requireAdmin, async (req, res) => {
  try {
    const counselorId = parseInt(req.query.counselor_id, 10);
    if (!counselorId) return res.status(400).json({ error: 'counselor_id erforderlich' });

    const dateFrom = req.query.date_from;
    const dateUntil = req.query.date_until;
    if (!dateFrom || !dateUntil) return res.status(400).json({ error: 'date_from und date_until erforderlich' });

    const { rows } = await query(
      `SELECT a.*, c.name AS category_name, c.icon AS category_icon
       FROM ssw_appointments a
       LEFT JOIN ssw_categories c ON c.id = a.category_id
       WHERE a.counselor_id = $1 AND a.date >= $2 AND a.date <= $3
       ORDER BY a.date, a.time`,
      [counselorId, dateFrom, dateUntil]
    );
    res.json({ appointments: rows });
  } catch (err) {
    console.error('SSW admin appointments error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Termine' });
  }
});

// DELETE /api/ssw/admin/appointments — bulk delete
// Body: { ids: [1, 2, 3] }
router.delete('/appointments', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids-Array erforderlich' });
    }

    const numericIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    if (numericIds.length === 0) return res.status(400).json({ error: 'Keine gültigen IDs' });

    const placeholders = numericIds.map((_, i) => `$${i + 1}`).join(', ');
    const { rowCount } = await query(
      `DELETE FROM ssw_appointments WHERE id IN (${placeholders})`,
      numericIds
    );
    res.json({ success: true, deleted: rowCount });
  } catch (err) {
    console.error('SSW admin delete appointments error:', err);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// ── Weekly Schedule ────────────────────────────────────────────────────

// GET /api/ssw/admin/counselors/:id/schedule
router.get('/counselors/:id/schedule', requireAdmin, async (req, res) => {
  try {
    const counselorId = parseInt(req.params.id, 10);
    const { rows } = await query(
      'SELECT * FROM ssw_weekly_schedule WHERE counselor_id = $1 ORDER BY weekday',
      [counselorId]
    );
    res.json({ schedule: rows });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden des Wochenplans' });
  }
});

// PUT /api/ssw/admin/counselors/:id/schedule
// Body: { schedule: [{ weekday: 0, start_time: "08:00", end_time: "14:00", active: true }, ...] }
router.put('/counselors/:id/schedule', requireAdmin, async (req, res) => {
  try {
    const counselorId = parseInt(req.params.id, 10);
    const { schedule } = req.body || {};

    if (!Array.isArray(schedule)) {
      return res.status(400).json({ error: 'schedule muss ein Array sein' });
    }

    // Validate each entry
    for (const entry of schedule) {
      const wd = parseInt(entry.weekday, 10);
      if (isNaN(wd) || wd < 0 || wd > 6) {
        return res.status(400).json({ error: `Ungültiger Wochentag: ${entry.weekday}` });
      }
      if (entry.active && (!entry.start_time || !entry.end_time)) {
        return res.status(400).json({ error: `Start- und Endzeit erforderlich für Tag ${wd}` });
      }
    }

    // Upsert each day
    for (const entry of schedule) {
      const wd = parseInt(entry.weekday, 10);
      await query(
        `INSERT INTO ssw_weekly_schedule (counselor_id, weekday, start_time, end_time, active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (counselor_id, weekday)
         DO UPDATE SET start_time = $3, end_time = $4, active = $5`,
        [counselorId, wd, entry.start_time || '08:00', entry.end_time || '14:00', entry.active !== false]
      );
    }

    const { rows } = await query(
      'SELECT * FROM ssw_weekly_schedule WHERE counselor_id = $1 ORDER BY weekday',
      [counselorId]
    );
    res.json({ success: true, schedule: rows });
  } catch (err) {
    console.error('SSW schedule update error:', err);
    res.status(500).json({ error: 'Fehler beim Speichern des Wochenplans' });
  }
});

export default router;
