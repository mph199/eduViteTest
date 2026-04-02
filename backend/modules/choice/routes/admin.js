/**
 * Choice-Modul – Admin-Routen
 *
 * CRUD fuer Groups, Options und Participants.
 * Auth via requireModuleAdmin('choice') im Modul-Manifest.
 */

import { Router } from 'express';
import multer from 'multer';
import { validate } from '../../../middleware/validate.js';
import {
  choiceGroupCreateSchema,
  choiceGroupUpdateSchema,
  choiceGroupStatusSchema,
  choiceOptionCreateSchema,
  choiceOptionUpdateSchema,
  choiceParticipantCreateSchema,
  choiceParticipantUpdateSchema,
} from '../../../schemas/choice.js';
import * as choiceService from '../services/choiceService.js';
import { parseParticipantCSV } from '../services/csvService.js';
import { createToken, invalidateTokensForParticipant } from '../services/tokenService.js';
import { sendInviteEmail } from '../services/emailService.js';
import logger from '../../../config/logger.js';

const log = logger.child({ component: 'choice-admin' });

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname || '').split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      cb(null, true);
    } else {
      cb(new Error('Nur CSV-Dateien sind erlaubt'));
    }
  },
});

/** Wrapper: fängt Multer-Fehler ab und gibt strukturiertes JSON zurück. */
function handleCsvUpload(req, res, next) {
  csvUpload.single('file')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Datei zu groß (maximal 2 MB)'
        : err.message || 'Fehler beim Datei-Upload';
      return res.status(400).json({ error: message });
    }
    next();
  });
}

const router = Router();

// ── Groups ──────────────────────────────────────────────────────────

// GET /groups – Liste aller Wahldaecher
router.get('/groups', async (req, res) => {
  try {
    const groups = await choiceService.listGroups();
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Wahldaecher' });
  }
});

// POST /groups – Neues Wahldach anlegen
router.post('/groups', validate(choiceGroupCreateSchema), async (req, res) => {
  try {
    const group = await choiceService.createGroup(req.body, req.user.id);
    res.status(201).json(group);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ein Wahldach mit diesem Titel existiert bereits' });
    }
    res.status(500).json({ error: 'Fehler beim Erstellen des Wahldachs' });
  }
});

// GET /groups/:id – Wahldach-Details
router.get('/groups/:id', async (req, res) => {
  try {
    const group = await choiceService.getGroupById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Wahldach nicht gefunden' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden des Wahldachs' });
  }
});

// PUT /groups/:id – Wahldach bearbeiten
router.put('/groups/:id', validate(choiceGroupUpdateSchema), async (req, res) => {
  try {
    const group = await choiceService.updateGroup(req.params.id, req.body);
    if (!group) return res.status(404).json({ error: 'Wahldach nicht gefunden' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Wahldachs' });
  }
});

// POST /groups/:id/status – Statuswechsel
router.post('/groups/:id/status', validate(choiceGroupStatusSchema), async (req, res) => {
  try {
    const result = await choiceService.changeGroupStatus(req.params.id, req.body.status);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Statuswechsel' });
  }
});

// ── Options ─────────────────────────────────────────────────────────

// GET /groups/:id/options – Optionen auflisten
router.get('/groups/:id/options', async (req, res) => {
  try {
    const options = await choiceService.listOptions(req.params.id);
    res.json(options);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Optionen' });
  }
});

// POST /groups/:id/options – Option hinzufuegen
router.post('/groups/:id/options', validate(choiceOptionCreateSchema), async (req, res) => {
  try {
    const option = await choiceService.createOption(req.params.id, req.body);
    res.status(201).json(option);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Eine Option mit diesem Titel existiert bereits in diesem Wahldach' });
    }
    if (err.code === '23503') {
      return res.status(404).json({ error: 'Wahldach nicht gefunden' });
    }
    res.status(500).json({ error: 'Fehler beim Erstellen der Option' });
  }
});

// PUT /options/:id – Option bearbeiten
router.put('/options/:id', validate(choiceOptionUpdateSchema), async (req, res) => {
  try {
    const option = await choiceService.updateOption(req.params.id, req.body);
    if (!option) return res.status(404).json({ error: 'Option nicht gefunden' });
    res.json(option);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Eine Option mit diesem Titel existiert bereits in diesem Wahldach' });
    }
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Option' });
  }
});

// POST /options/:id/deactivate – Option deaktivieren
router.post('/options/:id/deactivate', async (req, res) => {
  try {
    const option = await choiceService.deactivateOption(req.params.id);
    if (!option) return res.status(404).json({ error: 'Option nicht gefunden' });
    res.json(option);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Deaktivieren der Option' });
  }
});

// ── Participants ────────────────────────────────────────────────────

// GET /groups/:id/participants – Teilnehmerliste
router.get('/groups/:id/participants', async (req, res) => {
  try {
    const participants = await choiceService.listParticipants(req.params.id);
    res.json(participants);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Teilnehmer' });
  }
});

// POST /groups/:id/participants – Teilnehmer hinzufuegen (einzeln JSON oder CSV)
router.post('/groups/:id/participants', handleCsvUpload, async (req, res) => {
  try {
    const groupId = req.params.id;

    // Gruppen-Existenz pruefen
    const group = await choiceService.getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Wahldach nicht gefunden' });

    // CSV-Import wenn Datei vorhanden
    if (req.file) {
      const existingEmails = await choiceService.getExistingEmails(groupId);
      const { toInsert, skipped, errors } = parseParticipantCSV(req.file.buffer, existingEmails);

      if (errors.length) {
        return res.status(400).json({ error: errors[0], details: errors });
      }

      if (!toInsert.length) {
        return res.json({ imported: 0, skipped: skipped.length, total: skipped.length, details: { imported: [], skipped } });
      }

      const imported = await choiceService.bulkInsertParticipants(groupId, toInsert);
      return res.status(201).json({
        imported: imported.length,
        skipped: skipped.length,
        total: imported.length + skipped.length,
        details: { imported, skipped },
      });
    }

    // Multipart ohne Datei abfangen
    if (req.is('multipart/form-data')) {
      return res.status(400).json({ error: 'Keine CSV-Datei im Request gefunden (Feld: file)' });
    }

    // Einzelner Participant via JSON
    const result = choiceParticipantCreateSchema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return res.status(400).json({ error: 'Validierungsfehler', message: firstIssue?.message || 'Ungültige Eingabe' });
    }

    const participant = await choiceService.createParticipant(groupId, result.data);
    res.status(201).json(participant);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ein Teilnehmer mit dieser E-Mail existiert bereits in diesem Wahldach' });
    }
    res.status(500).json({ error: 'Fehler beim Hinzufügen von Teilnehmern' });
  }
});

// PUT /participants/:id – Teilnehmer bearbeiten
router.put('/participants/:id', validate(choiceParticipantUpdateSchema), async (req, res) => {
  try {
    const participant = await choiceService.updateParticipant(req.params.id, req.body);
    if (!participant) return res.status(404).json({ error: 'Teilnehmer nicht gefunden' });
    res.json(participant);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ein Teilnehmer mit dieser E-Mail existiert bereits in diesem Wahldach' });
    }
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Teilnehmers' });
  }
});

// POST /participants/:id/deactivate – Teilnehmer deaktivieren
router.post('/participants/:id/deactivate', async (req, res) => {
  try {
    const participant = await choiceService.deactivateParticipant(req.params.id);
    if (!participant) return res.status(404).json({ error: 'Teilnehmer nicht gefunden' });
    res.json(participant);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Deaktivieren des Teilnehmers' });
  }
});

// ── Submissions (Admin-Export) ──────────────────────────────────────

// GET /groups/:id/submissions – Alle Abgaben einer Gruppe (JSON oder CSV)
router.get('/groups/:id/submissions', async (req, res) => {
  try {
    const groupId = req.params.id;
    const group = await choiceService.getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Wahldach nicht gefunden' });

    const submissions = await choiceService.listSubmissions(groupId);

    if (req.query.format === 'csv') {
      const lines = ['Nachname;Vorname;E-Mail;Klasse;Status;Abgabe am;Optionen (Priorität)'];
      for (const s of submissions) {
        const optStr = (s.items || [])
          .map((i) => `${i.option_title} (${i.priority})`)
          .join(', ');
        lines.push([
          csvEscape(s.last_name),
          csvEscape(s.first_name),
          csvEscape(s.email),
          csvEscape(s.audience_label || ''),
          csvEscape(s.status),
          csvEscape(s.submitted_at ? new Date(s.submitted_at).toISOString() : ''),
          csvEscape(optStr),
        ].join(';'));
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="wahlen-${groupId}.csv"`);
      return res.send('\uFEFF' + lines.join('\n'));
    }

    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Abgaben' });
  }
});

/** CSV-Feld escapen (Semikolon-separiert, Formula-Injection-sicher). */
function csvEscape(val) {
  let str = String(val ?? '');
  // Formula-Injection-Schutz: gefährliche Präfixe neutralisieren
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes("'")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ── Invite ──────────────────────────────────────────────────────────

// POST /groups/:id/invite – Einladungsmails an aktive Teilnehmer senden
router.post('/groups/:id/invite', async (req, res) => {
  try {
    const groupId = req.params.id;
    const group = await choiceService.getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Wahldach nicht gefunden' });

    if (group.status !== 'open') {
      return res.status(400).json({ error: 'Einladungen können nur für geöffnete Wahldächer versendet werden' });
    }

    // Nur aktive Teilnehmer einladen
    const participants = await choiceService.listParticipants(groupId);
    const activeParticipants = (Array.isArray(participants) ? participants : []).filter((p) => p.is_active);

    if (!activeParticipants.length) {
      return res.status(400).json({ error: 'Keine aktiven Teilnehmer in diesem Wahldach' });
    }

    const results = { sent: 0, failed: 0, total: activeParticipants.length };

    for (const p of activeParticipants) {
      try {
        await invalidateTokensForParticipant(p.id);
        const { token } = await createToken(p.id);
        const { sent } = await sendInviteEmail(
          { email: p.email, firstName: p.first_name, lastName: p.last_name },
          group,
          token,
        );
        if (sent) results.sent++;
        else results.failed++;
      } catch (err) {
        log.error({ err, participantId: p.id }, 'Einladungsmail fehlgeschlagen');
        results.failed++;
      }
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Versenden der Einladungen' });
  }
});

export default router;
