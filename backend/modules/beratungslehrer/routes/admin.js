/**
 * Beratungslehrer – Admin-Routen
 *
 * Verwaltung von Beratungslehrern und Themen.
 */

import express from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { requireBeratungslehrer } from '../../../middleware/auth.js';
import { query } from '../../../config/db.js';

const router = express.Router();

// ── Counselors CRUD ────────────────────────────────────────────────────

// GET /api/bl/admin/counselors
router.get('/counselors', requireBeratungslehrer, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM bl_counselors ORDER BY last_name, first_name');
    res.json({ counselors: rows });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Beratungslehrer' });
  }
});

// POST /api/bl/admin/counselors
router.post('/counselors', requireBeratungslehrer, async (req, res) => {
  try {
    const { first_name, last_name, email, salutation, room, phone, specializations,
            available_from, available_until, slot_duration_minutes } = req.body || {};

    if (!last_name?.trim()) return res.status(400).json({ error: 'Nachname ist erforderlich' });

    const { username: reqUsername, password: reqPassword } = req.body || {};

    const { rows } = await query(
      `INSERT INTO bl_counselors (first_name, last_name, email, salutation, room, phone,
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

    const counselor = rows[0];

    // Auto-create linked user account
    let userInfo = null;
    try {
      let uname;
      if (reqUsername && typeof reqUsername === 'string' && reqUsername.trim()) {
        uname = reqUsername.trim();
      } else {
        const autoFirst = String(counselor.first_name || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '');
        const autoLast  = String(counselor.last_name  || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '');
        uname = (autoFirst && autoLast ? `${autoFirst}.${autoLast}` : autoFirst || autoLast || `bl${counselor.id}`).slice(0, 30);
      }
      const tempPassword = (reqPassword && typeof reqPassword === 'string' && reqPassword.trim())
        ? reqPassword.trim()
        : crypto.randomBytes(6).toString('base64url');
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const parsedEmail = email ? email.trim().toLowerCase() : null;

      const { rows: userRows } = await query(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, 'teacher')
         ON CONFLICT (username) DO UPDATE SET email = $2, password_hash = $3
         RETURNING id`,
        [uname, parsedEmail, passwordHash]
      );

      if (userRows[0]) {
        await query('UPDATE bl_counselors SET user_id = $1 WHERE id = $2', [userRows[0].id, counselor.id]);
        // Grant beratungslehrer module access
        await query(
          'INSERT INTO user_module_access (user_id, module_key) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [userRows[0].id, 'beratungslehrer']
        );
        counselor.user_id = userRows[0].id;
        userInfo = { username: uname, tempPassword };
      }
    } catch (userErr) {
      console.warn('User creation for BL counselor failed:', userErr?.message || userErr);
    }

    res.json({ success: true, counselor, user: userInfo });
  } catch (err) {
    console.error('BL create counselor error:', err);
    res.status(500).json({ error: 'Fehler beim Anlegen' });
  }
});

// PUT /api/bl/admin/counselors/:id
router.put('/counselors/:id', requireBeratungslehrer, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { first_name, last_name, email, salutation, room, phone, specializations,
            available_from, available_until, slot_duration_minutes, active } = req.body || {};

    if (!last_name?.trim()) return res.status(400).json({ error: 'Nachname ist erforderlich' });

    const { rows } = await query(
      `UPDATE bl_counselors SET
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

    if (!rows.length) return res.status(404).json({ error: 'Beratungslehrer nicht gefunden' });

    // Sync email to linked user account
    const counselor = rows[0];
    if (counselor.user_id) {
      try {
        await query('UPDATE users SET email = $1 WHERE id = $2', [
          email ? email.trim().toLowerCase() : null,
          counselor.user_id,
        ]);
      } catch (syncErr) {
        console.warn('Email sync to user failed:', syncErr?.message || syncErr);
      }
    }

    res.json({ success: true, counselor });
  } catch (err) {
    console.error('BL update counselor error:', err);
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// DELETE /api/bl/admin/counselors/:id
router.delete('/counselors/:id', requireBeratungslehrer, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const { rows: counselorRows } = await query('SELECT user_id FROM bl_counselors WHERE id = $1', [id]);
    const linkedUserId = counselorRows[0]?.user_id;

    const { rows } = await query('DELETE FROM bl_counselors WHERE id = $1 RETURNING id', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Beratungslehrer nicht gefunden' });

    if (linkedUserId) {
      try {
        // Remove beratungslehrer module access
        await query('DELETE FROM user_module_access WHERE user_id = $1 AND module_key = $2', [linkedUserId, 'beratungslehrer']);
      } catch (userErr) {
        console.warn('Removing BL module access failed:', userErr?.message || userErr);
      }
    }

    res.json({ success: true });
  } catch (err) {
    if (err?.code === '23503') {
      return res.status(409).json({ error: 'Beratungslehrer hat noch Termine. Bitte zuerst Termine loeschen oder deaktivieren.' });
    }
    res.status(500).json({ error: 'Fehler beim Loeschen' });
  }
});

// ── Topics CRUD ────────────────────────────────────────────────────────

// GET /api/bl/admin/topics
router.get('/topics', requireBeratungslehrer, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM bl_topics ORDER BY sort_order, id');
    res.json({ topics: rows });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Themen' });
  }
});

// POST /api/bl/admin/topics
router.post('/topics', requireBeratungslehrer, async (req, res) => {
  try {
    const { name, description, sort_order } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name ist erforderlich' });

    const { rows } = await query(
      'INSERT INTO bl_topics (name, description, sort_order) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), description || null, sort_order || 0]
    );
    res.json({ success: true, topic: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Anlegen' });
  }
});

// PUT /api/bl/admin/topics/:id
router.put('/topics/:id', requireBeratungslehrer, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description, sort_order, active } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name ist erforderlich' });

    const { rows } = await query(
      'UPDATE bl_topics SET name = $1, description = $2, sort_order = $3, active = $4 WHERE id = $5 RETURNING *',
      [name.trim(), description || null, sort_order || 0, active !== false, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Thema nicht gefunden' });
    res.json({ success: true, topic: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// ── Stats ──────────────────────────────────────────────────────────────

// GET /api/bl/admin/stats
router.get('/stats', requireBeratungslehrer, async (_req, res) => {
  try {
    const { rows: [counts] } = await query(`
      SELECT
        (SELECT COUNT(*) FROM bl_counselors WHERE active = TRUE) AS counselors,
        (SELECT COUNT(*) FROM bl_appointments WHERE status = 'requested') AS pending,
        (SELECT COUNT(*) FROM bl_appointments WHERE status = 'confirmed') AS confirmed,
        (SELECT COUNT(*) FROM bl_appointments WHERE status = 'available' AND date >= CURRENT_DATE) AS available
    `);
    res.json({ stats: counts });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Statistiken' });
  }
});

// ── Appointments (calendar management) ─────────────────────────────────

// GET /api/bl/admin/appointments?counselor_id=X&date_from=YYYY-MM-DD&date_until=YYYY-MM-DD
router.get('/appointments', requireBeratungslehrer, async (req, res) => {
  try {
    const counselorId = parseInt(req.query.counselor_id, 10);
    if (!counselorId) return res.status(400).json({ error: 'counselor_id erforderlich' });

    const dateFrom = req.query.date_from;
    const dateUntil = req.query.date_until;
    if (!dateFrom || !dateUntil) return res.status(400).json({ error: 'date_from und date_until erforderlich' });

    const { rows } = await query(
      `SELECT a.*, t.name AS topic_name
       FROM bl_appointments a
       LEFT JOIN bl_topics t ON t.id = a.topic_id
       WHERE a.counselor_id = $1 AND a.date >= $2 AND a.date <= $3
       ORDER BY a.date, a.time`,
      [counselorId, dateFrom, dateUntil]
    );
    res.json({ appointments: rows });
  } catch (err) {
    console.error('BL admin appointments error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Termine' });
  }
});

// DELETE /api/bl/admin/appointments — bulk delete
router.delete('/appointments', requireBeratungslehrer, async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids-Array erforderlich' });
    }

    const numericIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    if (numericIds.length === 0) return res.status(400).json({ error: 'Keine gueltigen IDs' });

    const placeholders = numericIds.map((_, i) => `$${i + 1}`).join(', ');
    const { rowCount } = await query(
      `DELETE FROM bl_appointments WHERE id IN (${placeholders})`,
      numericIds
    );
    res.json({ success: true, deleted: rowCount });
  } catch (err) {
    console.error('BL admin delete appointments error:', err);
    res.status(500).json({ error: 'Fehler beim Loeschen' });
  }
});

// ── Weekly Schedule ────────────────────────────────────────────────────

// GET /api/bl/admin/counselors/:id/schedule
router.get('/counselors/:id/schedule', requireBeratungslehrer, async (req, res) => {
  try {
    const counselorId = parseInt(req.params.id, 10);
    const { rows } = await query(
      'SELECT * FROM bl_weekly_schedule WHERE counselor_id = $1 ORDER BY weekday',
      [counselorId]
    );
    res.json({ schedule: rows });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden des Wochenplans' });
  }
});

// PUT /api/bl/admin/counselors/:id/schedule
router.put('/counselors/:id/schedule', requireBeratungslehrer, async (req, res) => {
  try {
    const counselorId = parseInt(req.params.id, 10);
    const { schedule } = req.body || {};

    if (!Array.isArray(schedule)) {
      return res.status(400).json({ error: 'schedule muss ein Array sein' });
    }

    for (const entry of schedule) {
      const wd = parseInt(entry.weekday, 10);
      if (isNaN(wd) || wd < 0 || wd > 6) {
        return res.status(400).json({ error: `Ungueltiger Wochentag: ${entry.weekday}` });
      }
      if (entry.active && (!entry.start_time || !entry.end_time)) {
        return res.status(400).json({ error: `Start- und Endzeit erforderlich fuer Tag ${wd}` });
      }
    }

    for (const entry of schedule) {
      const wd = parseInt(entry.weekday, 10);
      await query(
        `INSERT INTO bl_weekly_schedule (counselor_id, weekday, start_time, end_time, active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (counselor_id, weekday)
         DO UPDATE SET start_time = $3, end_time = $4, active = $5`,
        [counselorId, wd, entry.start_time || '08:00', entry.end_time || '14:00', entry.active !== false]
      );
    }

    const { rows } = await query(
      'SELECT * FROM bl_weekly_schedule WHERE counselor_id = $1 ORDER BY weekday',
      [counselorId]
    );
    res.json({ success: true, schedule: rows });
  } catch (err) {
    console.error('BL schedule update error:', err);
    res.status(500).json({ error: 'Fehler beim Speichern des Wochenplans' });
  }
});

export default router;
