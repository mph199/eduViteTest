import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { requireAdmin } from '../../middleware/auth.js';
import { query, getClient } from '../../config/db.js';
import { normalizeAndValidateTeacherEmail, normalizeAndValidateTeacherSalutation } from '../../utils/validators.js';
import { generateTimeSlotsForTeacher } from '../../utils/timeWindows.js';
import { resolveActiveEvent } from '../../utils/resolveActiveEvent.js';
import logger from '../../config/logger.js';
import { generateUsername, generateUniqueUsername } from '../../shared/generateUsername.js';

const router = express.Router();
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// ── CSV helpers ─────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ';' || ch === ',') { fields.push(current.trim()); current = ''; }
        else { current += ch; }
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headerLine = lines.findIndex(l => l.trim().length > 0);
  if (headerLine < 0) return { headers: [], rows: [] };
  const headers = parseLine(lines[headerLine]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = [];
  for (let i = headerLine + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseLine(line);
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
    rows.push(row);
  }
  return { headers, rows };
}

const COL_ALIASES = {
  last_name:  ['nachname', 'last_name', 'lastname', 'familienname', 'name'],
  first_name: ['vorname', 'first_name', 'firstname'],
  email:      ['email', 'e-mail', 'e_mail', 'mail'],
  salutation: ['anrede', 'salutation'],
  room:       ['raum', 'room', 'zimmer'],
  subject:    ['fach', 'subject', 'fächer'],
  available_from:  ['von', 'from', 'available_from', 'sprechzeit_von'],
  available_until: ['bis', 'until', 'available_until', 'sprechzeit_bis'],
};

function mapColumns(headers) {
  const mapping = {};
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    const found = headers.find(h => aliases.includes(h));
    if (found) mapping[field] = found;
  }
  return mapping;
}

// ── Helper: create user account for teacher ─────────────────────────────

function generateTeacherUsername(firstName, lastName, teacherId) {
  return generateUsername(firstName, lastName, teacherId, 'teacher');
}

// ── Helper: insert slots for a teacher ──────────────────────────────────

async function insertTeacherSlots(teacherId, availFrom, availUntil, targetEventId, eventDate) {
  const timeSlots = generateTimeSlotsForTeacher(availFrom, availUntil);
  if (!timeSlots.length || !eventDate) return timeSlots.length;

  const now = new Date().toISOString();
  const slotCols = ['teacher_id', 'event_id', 'time', 'date', 'booked', 'updated_at'];
  const placeholders = [];
  const vals = [];
  let pIdx = 1;
  for (const time of timeSlots) {
    placeholders.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5})`);
    vals.push(teacherId, targetEventId, time, eventDate, false, now);
    pIdx += 6;
  }
  try {
    await query(`INSERT INTO slots (${slotCols.join(', ')}) VALUES ${placeholders.join(', ')}`, vals);
  } catch (slotsError) {
    logger.error({ err: slotsError }, 'Error creating slots');
  }
  return timeSlots.length;
}

// ── Routes ──────────────────────────────────────────────────────────────

// POST /api/admin/teachers
router.post('/teachers', requireAdmin, async (req, res) => {
  const { first_name, last_name, name, email, salutation, subject, room, available_from, available_until, username: reqUsername, password: reqPassword } = req.body || {};

  // Support both new (first_name/last_name) and legacy (name) field
  let firstName = (first_name || '').trim();
  let lastName  = (last_name  || '').trim();
  if (!firstName && !lastName && name) {
    const parts = String(name).trim().split(/\s+/);
    lastName  = parts.pop() || '';
    firstName = parts.join(' ');
  }
  if (!lastName) {
    return res.status(400).json({ error: 'Nachname ist erforderlich' });
  }

  const parsedEmail = normalizeAndValidateTeacherEmail(email);
  if (!parsedEmail.ok) {
    return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse eingeben.' });
  }

  const parsedSalutation = normalizeAndValidateTeacherSalutation(salutation);
  if (!parsedSalutation.ok) {
    return res.status(400).json({ error: 'Ungültige Anrede. Erlaubt: Herr, Frau, Divers.' });
  }

  // Username + password are required
  const username = (reqUsername && typeof reqUsername === 'string') ? reqUsername.trim() : '';
  if (!username) {
    return res.status(400).json({ error: 'Benutzername ist erforderlich' });
  }

  const tempPassword = (reqPassword && typeof reqPassword === 'string') ? reqPassword.trim() : '';
  if (!tempPassword || tempPassword.length < 8) {
    return res.status(400).json({ error: 'Passwort ist erforderlich (mindestens 8 Zeichen)' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Check for duplicate username inside the transaction
    const { rows: existingUser } = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Benutzername "${username}" ist bereits vergeben` });
    }

    const availFrom = available_from || '16:00';
    const availUntil = available_until || '19:00';

    // Create teacher
    const { rows: newTeacherRows } = await client.query(
      'INSERT INTO teachers (first_name, last_name, email, salutation, subject, available_from, available_until, room) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [firstName, lastName, parsedEmail.email, parsedSalutation.salutation, subject || 'Sprechstunde', availFrom, availUntil, room ? room.trim() : null]
    );
    const teacher = newTeacherRows[0];

    // Create linked user account (no ON CONFLICT – duplicates are rejected)
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const { rows: userRows } = await client.query(
      'INSERT INTO users (username, email, password_hash, role, teacher_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [username, parsedEmail.email, passwordHash, 'teacher', teacher.id]
    );
    const userId = userRows[0]?.id ?? null;

    // Optional: Beratungslehrer-Profil anlegen
    const blData = req.body.beratungslehrer;
    if (blData && userId) {
      const { rows: blRows } = await client.query(
        `INSERT INTO bl_counselors (first_name, last_name, email, salutation, room, phone,
         specializations, available_from, available_until, slot_duration_minutes, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [
          firstName, lastName, parsedEmail.email, parsedSalutation.salutation,
          (blData.room || room || '').trim() || null,
          (blData.phone || '').trim() || null,
          blData.specializations || null,
          blData.available_from || '08:00',
          blData.available_until || '14:00',
          blData.slot_duration_minutes || 30,
          userId,
        ]
      );
      const blCounselorId = blRows[0]?.id;
      await client.query(
        'INSERT INTO user_module_access (user_id, module_key) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, 'beratungslehrer']
      );
      if (Array.isArray(blData.schedule) && blCounselorId) {
        for (const entry of blData.schedule) {
          const wd = parseInt(entry.weekday, 10);
          if (isNaN(wd) || wd < 0 || wd > 6) continue;
          await client.query(
            `INSERT INTO bl_weekly_schedule (counselor_id, weekday, start_time, end_time, active)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (counselor_id, weekday)
             DO UPDATE SET start_time = $3, end_time = $4, active = $5`,
            [blCounselorId, wd, entry.start_time || '08:00', entry.end_time || '14:00', entry.active !== false]
          );
        }
      }
    }

    await client.query('COMMIT');

    // Generate time slots outside transaction (non-critical, can fail independently)
    const { eventId: targetEventId, eventDate } = await resolveActiveEvent();
    let slotsCreated = 0;
    try {
      slotsCreated = await insertTeacherSlots(teacher.id, availFrom, availUntil, targetEventId, eventDate);
    } catch (slotErr) {
      logger.warn({ err: slotErr }, 'Slot creation failed (teacher+user created successfully)');
    }

    res.json({
      success: true,
      teacher,
      slotsCreated,
      slotsEventId: targetEventId,
      slotsEventDate: eventDate,
      user: { username, tempPassword }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    // UNIQUE constraint violation (race condition)
    if (error.code === '23505' && error.constraint?.includes('username')) {
      return res.status(409).json({ error: `Benutzername "${username}" ist bereits vergeben` });
    }
    logger.error({ err: error }, 'Error creating teacher');
    res.status(500).json({ error: 'Fehler beim Anlegen des Nutzers' });
  } finally {
    client.release();
  }
});

// GET /api/admin/teachers
router.get('/teachers', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT t.*,
             bl.id AS bl_counselor_id,
             bl.phone AS bl_phone,
             bl.specializations AS bl_specializations,
             bl.slot_duration_minutes AS bl_slot_duration_minutes,
             bl.active AS bl_active
      FROM teachers t
      LEFT JOIN users u ON u.teacher_id = t.id
      LEFT JOIN bl_counselors bl ON bl.user_id = u.id AND bl.active = true
      ORDER BY t.id
    `);
    return res.json({ teachers: rows || [] });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching admin teachers');
    return res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// GET /api/admin/teachers/:id/bl
router.get('/teachers/:id/bl', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) return res.status(400).json({ error: 'Invalid teacher ID' });

  try {
    const { rows: blRows } = await query(
      `SELECT bl.* FROM bl_counselors bl
       JOIN users u ON u.id = bl.user_id
       WHERE u.teacher_id = $1 LIMIT 1`,
      [teacherId]
    );
    if (!blRows.length) return res.json({ counselor: null, schedule: [] });

    const counselor = blRows[0];
    const { rows: scheduleRows } = await query(
      'SELECT * FROM bl_weekly_schedule WHERE counselor_id = $1 ORDER BY weekday',
      [counselor.id]
    );
    return res.json({ counselor, schedule: scheduleRows });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching BL data for teacher');
    return res.status(500).json({ error: 'Failed to fetch BL data' });
  }
});

// POST /api/admin/teachers/import-csv
router.post('/teachers/import-csv', requireAdmin, csvUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen.' });
    }

    const text = req.file.buffer.toString('utf-8');
    const { headers, rows } = parseCSV(text);

    if (!rows.length) {
      return res.status(400).json({ error: 'Die CSV-Datei enthält keine Datenzeilen.' });
    }

    const colMap = mapColumns(headers);
    if (!colMap.last_name) {
      return res.status(400).json({
        error: 'Pflicht-Spalte "Nachname" nicht gefunden. Erkannte Spalten: ' + headers.join(', '),
        hint: 'Erwartete Spalten: Nachname, Vorname, Email, Anrede (Trennzeichen: Semikolon oder Komma)',
      });
    }
    if (!colMap.email) {
      return res.status(400).json({
        error: 'Pflicht-Spalte "Email" nicht gefunden. Erkannte Spalten: ' + headers.join(', '),
        hint: 'Erwartete Spalten: Nachname, Vorname, Email, Anrede',
      });
    }

    const { eventId: targetEventId, eventDate } = await resolveActiveEvent();

    // Fetch existing emails to detect duplicates
    const { rows: existingTeachers } = await query('SELECT email FROM teachers WHERE email IS NOT NULL');
    const existingEmails = new Set(existingTeachers.map(t => t.email.toLowerCase()));

    const imported = [];
    const skipped = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2;

      const lastName  = (row[colMap.last_name]  || '').trim();
      const firstName = colMap.first_name ? (row[colMap.first_name] || '').trim() : '';
      const rawEmail  = (row[colMap.email] || '').trim();
      const rawSalut  = colMap.salutation ? (row[colMap.salutation] || '').trim() : '';
      const rawRoom   = colMap.room ? (row[colMap.room] || '').trim() : '';
      const rawSubj   = colMap.subject ? (row[colMap.subject] || '').trim() : '';
      const rawFrom   = colMap.available_from ? (row[colMap.available_from] || '').trim() : '';
      const rawUntil  = colMap.available_until ? (row[colMap.available_until] || '').trim() : '';

      if (!lastName) { skipped.push({ line: lineNum, reason: 'Nachname fehlt' }); continue; }

      const parsedEmail = normalizeAndValidateTeacherEmail(rawEmail);
      if (!parsedEmail.ok) { skipped.push({ line: lineNum, reason: `Ungültige E-Mail: ${rawEmail}`, name: `${firstName} ${lastName}`.trim() }); continue; }

      if (existingEmails.has(parsedEmail.email)) { skipped.push({ line: lineNum, reason: `E-Mail existiert bereits: ${parsedEmail.email}`, name: `${firstName} ${lastName}`.trim() }); continue; }

      let salutation = null;
      if (rawSalut) {
        const parsed = normalizeAndValidateTeacherSalutation(rawSalut.charAt(0).toUpperCase() + rawSalut.slice(1).toLowerCase());
        if (parsed.ok) salutation = parsed.salutation;
      }

      const availFrom = rawFrom || '16:00';
      const availUntil = rawUntil || '19:00';

      const { rows: tRows } = await query(
        'INSERT INTO teachers (first_name, last_name, email, salutation, subject, available_from, available_until, room) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [firstName, lastName, parsedEmail.email, salutation, rawSubj || 'Sprechstunde', availFrom, availUntil, rawRoom || null]
      );
      const teacher = tRows[0];
      existingEmails.add(parsedEmail.email);

      const slotsCreated = await insertTeacherSlots(teacher.id, availFrom, availUntil, targetEventId, eventDate);

      // Create user account with unique username
      const username = await generateUniqueUsername(firstName, lastName, teacher.id, 'teacher', query);
      const tempPassword = crypto.randomBytes(6).toString('base64url');
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      try {
        await query(
          'INSERT INTO users (username, email, password_hash, role, teacher_id) VALUES ($1, $2, $3, $4, $5)',
          [username, parsedEmail.email, passwordHash, 'teacher', teacher.id]
        );
      } catch (userErr) {
        logger.warn({ err: userErr, username }, 'User creation failed during CSV import');
      }

      imported.push({
        id: teacher.id,
        name: `${firstName} ${lastName}`.trim(),
        email: parsedEmail.email,
        username,
        tempPassword,
        slotsCreated,
      });
    }

    res.json({
      success: true,
      imported: imported.length,
      skipped: skipped.length,
      total: rows.length,
      details: { imported, skipped },
    });
  } catch (error) {
    logger.error({ err: error }, 'CSV import error');
    res.status(500).json({ error: 'Fehler beim CSV-Import: ' + (error?.message || 'Unbekannter Fehler') });
  }
});

// PUT /api/admin/teachers/:id
router.put('/teachers/:id', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }

  try {
    const { first_name, last_name, name, email, salutation, subject, room, available_from, available_until } = req.body || {};

    let firstName = (first_name || '').trim();
    let lastName  = (last_name  || '').trim();
    if (!firstName && !lastName && name) {
      const parts = String(name).trim().split(/\s+/);
      lastName  = parts.pop() || '';
      firstName = parts.join(' ');
    }
    if (!lastName) {
      return res.status(400).json({ error: 'Nachname ist erforderlich' });
    }

    const parsedEmail = normalizeAndValidateTeacherEmail(email);
    if (!parsedEmail.ok) {
      return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse eingeben.' });
    }

    const parsedSalutation = normalizeAndValidateTeacherSalutation(salutation);
    if (!parsedSalutation.ok) {
      return res.status(400).json({ error: 'Ungültige Anrede. Erlaubt: Herr, Frau, Divers.' });
    }

    const availFrom = available_from || '16:00';
    const availUntil = available_until || '19:00';

    const { rows } = await query(
      `UPDATE teachers SET first_name = $1, last_name = $2, email = $3, salutation = $4, subject = $5, available_from = $6, available_until = $7, room = $8
       WHERE id = $9 RETURNING *`,
      [firstName, lastName, parsedEmail.email, parsedSalutation.salutation, subject || 'Sprechstunde', availFrom, availUntil, room ? room.trim() : null, teacherId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    // Sync email to linked user account
    await query(
      'UPDATE users SET email = $1 WHERE teacher_id = $2',
      [parsedEmail.email, teacherId]
    );

    // Optional: Beratungslehrer-Profil anlegen/aktualisieren/deaktivieren
    const blData = req.body.beratungslehrer;
    if (blData !== undefined) {
      try {
        const { rows: userRows } = await query('SELECT id FROM users WHERE teacher_id = $1 LIMIT 1', [teacherId]);
        const userId = userRows[0]?.id;
        if (userId) {
          if (blData === null || blData === false) {
            await query('UPDATE bl_counselors SET active = false WHERE user_id = $1', [userId]);
            await query('DELETE FROM user_module_access WHERE user_id = $1 AND module_key = $2', [userId, 'beratungslehrer']);
          } else {
            const { rows: existingBl } = await query('SELECT id FROM bl_counselors WHERE user_id = $1', [userId]);
            if (existingBl.length) {
              await query(
                `UPDATE bl_counselors SET
                   room = $1, phone = $2, specializations = $3,
                   available_from = $4, available_until = $5,
                   slot_duration_minutes = $6, active = true,
                   first_name = $7, last_name = $8, email = $9, salutation = $10
                 WHERE user_id = $11`,
                [
                  (blData.room || '').trim() || null,
                  (blData.phone || '').trim() || null,
                  blData.specializations || null,
                  blData.available_from || '08:00',
                  blData.available_until || '14:00',
                  blData.slot_duration_minutes || 30,
                  firstName, lastName, parsedEmail.email, parsedSalutation.salutation,
                  userId,
                ]
              );
              if (Array.isArray(blData.schedule)) {
                for (const entry of blData.schedule) {
                  const wd = parseInt(entry.weekday, 10);
                  if (isNaN(wd) || wd < 0 || wd > 6) continue;
                  await query(
                    `INSERT INTO bl_weekly_schedule (counselor_id, weekday, start_time, end_time, active)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (counselor_id, weekday)
                     DO UPDATE SET start_time = $3, end_time = $4, active = $5`,
                    [existingBl[0].id, wd, entry.start_time || '08:00', entry.end_time || '14:00', entry.active !== false]
                  );
                }
              }
            } else {
              const { rows: blRows } = await query(
                `INSERT INTO bl_counselors (first_name, last_name, email, salutation, room, phone,
                 specializations, available_from, available_until, slot_duration_minutes, user_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
                [
                  firstName, lastName, parsedEmail.email, parsedSalutation.salutation,
                  (blData.room || '').trim() || null,
                  (blData.phone || '').trim() || null,
                  blData.specializations || null,
                  blData.available_from || '08:00',
                  blData.available_until || '14:00',
                  blData.slot_duration_minutes || 30,
                  userId,
                ]
              );
              const blCounselorId = blRows[0]?.id;
              if (Array.isArray(blData.schedule) && blCounselorId) {
                for (const entry of blData.schedule) {
                  const wd = parseInt(entry.weekday, 10);
                  if (isNaN(wd) || wd < 0 || wd > 6) continue;
                  await query(
                    `INSERT INTO bl_weekly_schedule (counselor_id, weekday, start_time, end_time, active)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (counselor_id, weekday)
                     DO UPDATE SET start_time = $3, end_time = $4, active = $5`,
                    [blCounselorId, wd, entry.start_time || '08:00', entry.end_time || '14:00', entry.active !== false]
                  );
                }
              }
            }
            await query(
              'INSERT INTO user_module_access (user_id, module_key) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [userId, 'beratungslehrer']
            );
          }
        }
      } catch (blErr) {
        logger.warn({ err: blErr }, 'BL counselor update failed');
      }
    }

    res.json({ success: true, teacher: rows[0] });
  } catch (error) {
    logger.error({ err: error }, 'Error updating teacher');
    res.status(500).json({ error: 'Failed to update teacher' });
  }
});

// PUT /api/admin/teachers/:id/reset-login
router.put('/teachers/:id/reset-login', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }

  try {
    const { rows: users } = await query('SELECT id, username, email, role, teacher_id, created_at FROM users WHERE teacher_id = $1 LIMIT 1', [teacherId]);
    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'Kein Benutzer für diese Lehrkraft gefunden' });
    }

    const user = users[0];
    const tempPassword = crypto.randomBytes(6).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);

    res.json({ success: true, user: { username: user.username, tempPassword } });
  } catch (error) {
    logger.error({ err: error }, 'Error resetting teacher login');
    res.status(500).json({ error: 'Failed to reset teacher login' });
  }
});

// DELETE /api/admin/teachers/:id
router.delete('/teachers/:id', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: bookedSlots } = await client.query('SELECT id, booked FROM slots WHERE teacher_id = $1', [teacherId]);
    const hasBookedSlots = bookedSlots && bookedSlots.some(slot => slot.booked);

    if (hasBookedSlots) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        error: 'Lehrkraft kann nicht gelöscht werden, da noch gebuchte Termine existieren. Bitte zuerst alle gebuchten Termine stornieren.'
      });
    }

    if (bookedSlots && bookedSlots.length > 0) {
      await client.query('DELETE FROM slots WHERE teacher_id = $1', [teacherId]);
    }

    // Find the user linked to this teacher so we can clean up counselor profiles
    const { rows: userRows } = await client.query('SELECT id FROM users WHERE teacher_id = $1', [teacherId]);
    const userId = userRows[0]?.id;

    // Delete BL counselor profile (if any) before deleting the user,
    // preventing ghost entries from ON DELETE SET NULL
    if (userId) {
      await client.query('DELETE FROM bl_counselors WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM user_module_access WHERE user_id = $1 AND module_key = $2', [userId, 'beratungslehrer']);
    }

    await client.query('DELETE FROM users WHERE teacher_id = $1', [teacherId]);
    await client.query('DELETE FROM teachers WHERE id = $1', [teacherId]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Teacher deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ err: error }, 'Error deleting teacher');
    res.status(500).json({ error: 'Failed to delete teacher' });
  } finally {
    client.release();
  }
});

// POST /api/admin/teachers/:id/generate-slots
router.post('/teachers/:id/generate-slots', requireAdmin, async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }

  try {
    const { rows: teacherRows } = await query('SELECT id, available_from, available_until FROM teachers WHERE id = $1', [teacherId]);
    const teacherRow = teacherRows[0];
    if (!teacherRow) return res.status(404).json({ error: 'Teacher not found' });

    const { eventId: targetEventId, eventDate } = await resolveActiveEvent();

    const times = generateTimeSlotsForTeacher(teacherRow.available_from, teacherRow.available_until);
    const now = new Date().toISOString();

    // Avoid duplicates
    let existingConditions = 'teacher_id = $1 AND date = $2';
    let existingParams = [teacherId, eventDate];
    if (targetEventId === null) {
      existingConditions += ' AND event_id IS NULL';
    } else {
      existingConditions += ' AND event_id = $3';
      existingParams.push(targetEventId);
    }

    const { rows: existingSlots } = await query(
      `SELECT time FROM slots WHERE ${existingConditions}`,
      existingParams
    );
    const existingTimes = new Set((existingSlots || []).map((s) => s.time));

    const inserts = [];
    let skipped = 0;
    for (const time of times) {
      if (existingTimes.has(time)) {
        skipped += 1;
        continue;
      }
      inserts.push({
        teacher_id: teacherId,
        event_id: targetEventId,
        time,
        date: eventDate,
        booked: false,
        updated_at: now,
      });
    }

    if (inserts.length) {
      const values = inserts.map((ins, i) => {
        const base = i * 6;
        return `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}, $${base+6})`;
      }).join(', ');
      const flatParams = inserts.flatMap(ins => [
        ins.teacher_id, ins.event_id, ins.time, ins.date, ins.booked, ins.updated_at
      ]);
      await query(
        `INSERT INTO slots (teacher_id, event_id, time, date, booked, updated_at) VALUES ${values}`,
        flatParams
      );
    }

    return res.json({ success: true, teacherId, eventId: targetEventId, eventDate, created: inserts.length, skipped });
  } catch (error) {
    logger.error({ err: error }, 'Error generating slots for teacher');
    return res.status(500).json({ error: 'Failed to generate slots for teacher' });
  }
});

export default router;
