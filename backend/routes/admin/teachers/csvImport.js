import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { requireAdmin } from '../../../middleware/auth.js';
import { query } from '../../../config/db.js';
import { normalizeAndValidateTeacherEmail, normalizeAndValidateTeacherSalutation } from '../../../utils/validators.js';
import { resolveActiveEvent } from '../../../utils/resolveActiveEvent.js';
import logger from '../../../config/logger.js';
import { generateUniqueUsername } from '../../../shared/generateUsername.js';
import { parseCSV, mapColumns } from '../../../utils/csvImport.js';
import { insertTeacherSlots } from './helpers.js';

const router = express.Router();

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel'];
    const ext = (file.originalname || '').split('.').pop()?.toLowerCase();
    if (allowed.includes(file.mimetype) && ext === 'csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
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
          'INSERT INTO users (username, email, password_hash, role, teacher_id, force_password_change) VALUES ($1, $2, $3, $4, $5, true)',
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
    res.status(500).json({ error: 'Fehler beim CSV-Import' });
  }
});

export default router;
