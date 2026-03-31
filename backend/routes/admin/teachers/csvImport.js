import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { requireAdmin } from '../../../middleware/auth.js';
import { db } from '../../../db/database.js';
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
    if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen.' });

    const text = req.file.buffer.toString('utf-8');
    const { headers, rows } = parseCSV(text);

    if (!rows.length) return res.status(400).json({ error: 'Die CSV-Datei enthält keine Datenzeilen.' });

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

    const existingTeachers = await db.selectFrom('teachers')
      .select('email')
      .where('email', 'is not', null)
      .execute();
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

      const teacher = await db.insertInto('teachers')
        .values({
          first_name: firstName, last_name: lastName, email: parsedEmail.email,
          salutation, subject: rawSubj || 'Sprechstunde',
          available_from: availFrom, available_until: availUntil,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      existingEmails.add(parsedEmail.email);

      const slotsCreated = await insertTeacherSlots(teacher.id, availFrom, availUntil, targetEventId, eventDate);

      const username = await generateUniqueUsername(firstName, lastName, teacher.id, 'teacher');
      const tempPassword = crypto.randomBytes(6).toString('base64url');
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      try {
        await db.insertInto('users')
          .values({
            username, email: parsedEmail.email, password_hash: passwordHash,
            role: 'teacher', teacher_id: teacher.id, force_password_change: true,
          })
          .execute();
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
