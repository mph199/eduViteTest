/**
 * Beratungslehrer – Berater-Routen (authentifiziert)
 *
 * Endpunkte fuer Beratungslehrer: eigene Termine verwalten,
 * Anfragen bestaetigen/absagen, Notizen pflegen.
 */

import express from 'express';
import { requireAuth, hasModuleAccess } from '../../../middleware/auth.js';
import { query } from '../../../config/db.js';
import { generateTimeSlots } from '../services/appointmentService.js';

const router = express.Router();

/**
 * Middleware: resolve counselor from authenticated user.
 */
async function requireBLCounselor(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Nicht angemeldet' });

  try {
    // Admin/Superadmin: can access any counselor by ID
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      const counselorId = parseInt(req.query.counselor_id || req.body?.counselor_id, 10) || null;
      if (counselorId) {
        const { rows } = await query('SELECT * FROM bl_counselors WHERE id = $1', [counselorId]);
        req.counselor = rows[0] || null;
      }
      return next();
    }

    // Users with beratungslehrer module access: only own counselor profile
    if (hasModuleAccess(req.user, 'beratungslehrer')) {
      const { rows } = await query('SELECT * FROM bl_counselors WHERE user_id = $1 AND active = TRUE', [req.user.id]);
      if (!rows.length) return res.status(403).json({ error: 'Kein Beratungslehrer-Profil zugeordnet' });
      req.counselor = rows[0];
      return next();
    }

    // No access
    return res.status(403).json({ error: 'Kein Beratungslehrer-Zugang' });
  } catch (err) {
    console.error('requireBLCounselor error:', err);
    return res.status(500).json({ error: 'Interner Fehler bei Berechtigungspruefung' });
  }
}

// GET /api/bl/counselor/appointments?date=YYYY-MM-DD — own appointments
router.get('/appointments', requireAuth, requireBLCounselor, async (req, res) => {
  try {
    const counselorId = req.counselor?.id;
    if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

    const date = req.query.date;
    let dateFilter = '';
    const params = [counselorId];

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      dateFilter = ' AND a.date = $2';
      params.push(date);
    }

    const { rows } = await query(
      `SELECT a.*, t.name AS topic_name
       FROM bl_appointments a
       LEFT JOIN bl_topics t ON t.id = a.topic_id
       WHERE a.counselor_id = $1 ${dateFilter}
       ORDER BY a.date, a.time`,
      params
    );
    res.json({ appointments: rows });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Termine' });
  }
});

// POST /api/bl/counselor/generate-slots — generate available slots for a date range
router.post('/generate-slots', requireAuth, requireBLCounselor, async (req, res) => {
  try {
    const counselorId = req.counselor?.id;
    if (!counselorId) return res.status(400).json({ error: 'Berater-ID erforderlich' });

    const { date_from, date_until, exclude_weekends = true } = req.body || {};
    if (!date_from || !/^\d{4}-\d{2}-\d{2}$/.test(date_from)) {
      return res.status(400).json({ error: 'date_from im Format YYYY-MM-DD erforderlich' });
    }

    const endDate = date_until && /^\d{4}-\d{2}-\d{2}$/.test(date_until) ? date_until : date_from;

    // Get counselor details
    const { rows: cRows } = await query('SELECT * FROM bl_counselors WHERE id = $1', [counselorId]);
    const counselor = cRows[0];
    if (!counselor) return res.status(404).json({ error: 'Beratungslehrer nicht gefunden' });

    // Load weekly schedule (if exists)
    const { rows: scheduleRows } = await query(
      'SELECT * FROM bl_weekly_schedule WHERE counselor_id = $1 AND active = TRUE ORDER BY weekday',
      [counselorId]
    );

    // Build a map: JS weekday (0=Sun..6=Sat) -> { start_time, end_time }
    // DB weekday: 0=Mon..4=Fri,5=Sat,6=Sun -> JS: Mon=1..Fri=5,Sat=6,Sun=0
    const scheduleByJsDay = new Map();
    for (const s of scheduleRows) {
      const jsDay = s.weekday === 6 ? 0 : s.weekday + 1;
      scheduleByJsDay.set(jsDay, {
        start: s.start_time?.toString()?.slice(0, 5),
        end: s.end_time?.toString()?.slice(0, 5),
      });
    }

    const hasSchedule = scheduleByJsDay.size > 0;
    const duration = counselor.slot_duration_minutes || 30;

    const defaultFrom = counselor.available_from?.toString()?.slice(0, 5) || '08:00';
    const defaultUntil = counselor.available_until?.toString()?.slice(0, 5) || '14:00';

    let totalCreated = 0;
    let totalSkipped = 0;
    const start = new Date(date_from);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();

      let fromStr, untilStr;
      if (hasSchedule) {
        const entry = scheduleByJsDay.get(dayOfWeek);
        if (!entry) continue;
        fromStr = entry.start;
        untilStr = entry.end;
      } else {
        if (exclude_weekends && (dayOfWeek === 0 || dayOfWeek === 6)) continue;
        fromStr = defaultFrom;
        untilStr = defaultUntil;
      }

      const timeSlots = generateTimeSlots(fromStr, untilStr, duration);
      const dateStr = d.toISOString().slice(0, 10);

      const { rows: existing } = await query(
        'SELECT time FROM bl_appointments WHERE counselor_id = $1 AND date = $2',
        [counselorId, dateStr]
      );
      const existingTimes = new Set(existing.map(r => r.time?.toString()?.slice(0, 5)));

      const newSlots = timeSlots.filter(t => !existingTimes.has(t));
      totalSkipped += existingTimes.size;
      if (!newSlots.length) continue;

      const cols = ['counselor_id', 'date', 'time', 'duration_minutes', 'status'];
      const placeholders = [];
      const vals = [];
      let pIdx = 1;
      for (const time of newSlots) {
        placeholders.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4})`);
        vals.push(counselorId, dateStr, time, duration, 'available');
        pIdx += 5;
      }
      await query(`INSERT INTO bl_appointments (${cols.join(', ')}) VALUES ${placeholders.join(', ')}`, vals);
      totalCreated += newSlots.length;
    }

    res.json({ success: true, created: totalCreated, skipped: totalSkipped });
  } catch (err) {
    console.error('BL generate-slots error:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen der Termine' });
  }
});

// PUT /api/bl/counselor/appointments/:id/confirm
router.put('/appointments/:id/confirm', requireAuth, requireBLCounselor, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const counselorId = req.counselor?.id;

    const whereClause = counselorId ? 'AND counselor_id = $2' : '';
    const params = counselorId ? [id, counselorId] : [id];

    const { rows } = await query(
      `UPDATE bl_appointments SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'requested' ${whereClause} RETURNING *`,
      params
    );

    if (!rows.length) return res.status(404).json({ error: 'Termin nicht gefunden oder nicht im Status "angefragt"' });
    res.json({ success: true, appointment: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Bestaetigen' });
  }
});

// PUT /api/bl/counselor/appointments/:id/cancel
router.put('/appointments/:id/cancel', requireAuth, requireBLCounselor, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const counselorId = req.counselor?.id;

    const whereClause = counselorId ? 'AND counselor_id = $2' : '';
    const params = counselorId ? [id, counselorId] : [id];

    const { rows } = await query(
      `UPDATE bl_appointments SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND status IN ('requested', 'confirmed', 'available') ${whereClause} RETURNING *`,
      params
    );

    if (!rows.length) return res.status(404).json({ error: 'Termin nicht gefunden' });
    res.json({ success: true, appointment: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Absagen' });
  }
});

// PUT /api/bl/counselor/appointments/:id/notes
router.put('/appointments/:id/notes', requireAuth, requireBLCounselor, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { notes } = req.body || {};
    const counselorId = req.counselor?.id;

    const noteVal = typeof notes === 'string' ? notes : '';
    const whereClause = counselorId ? 'AND counselor_id = $3' : '';
    const params = counselorId ? [noteVal, id, counselorId] : [noteVal, id];

    const { rows } = await query(
      `UPDATE bl_appointments SET notes = $1, updated_at = NOW()
       WHERE id = $2 ${whereClause} RETURNING *`,
      params
    );

    if (!rows.length) return res.status(404).json({ error: 'Termin nicht gefunden' });
    res.json({ success: true, appointment: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Speichern der Notiz' });
  }
});

export default router;
