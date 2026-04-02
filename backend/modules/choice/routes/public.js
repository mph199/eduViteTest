/**
 * Choice-Modul – Public-Routen (kein Admin-Auth).
 *
 * Verify-Endpoint, Request-Access und Session-geschützte Abfragen.
 * Rate-Limited im Modul-Manifest.
 */

import { Router } from 'express';
import { validate } from '../../../middleware/validate.js';
import {
  choiceVerifySchema,
  choiceRequestAccessSchema,
  choiceDraftSchema,
  choiceSubmitSchema,
} from '../../../schemas/choice.js';
import { validateAndConsumeToken, createToken, invalidateTokensForParticipant } from '../services/tokenService.js';
import { sendInviteEmail } from '../services/emailService.js';
import { createChoiceSessionToken, choiceCookieOptions, requireChoiceSession } from '../middleware/publicAuth.js';
import * as choiceService from '../services/choiceService.js';
import { db } from '../../../db/database.js';
import logger from '../../../config/logger.js';

const log = logger.child({ component: 'choice-public' });
const router = Router();

// ── POST /verify – Token validieren, Session-Cookie setzen ──────────

router.post('/verify', validate(choiceVerifySchema), async (req, res) => {
  try {
    const result = await validateAndConsumeToken(req.body.token);
    if (!result) {
      return res.status(401).json({ error: 'Ungültiger oder abgelaufener Link' });
    }

    // Prüfen ob Gruppe offen ist
    const group = await choiceService.getGroupById(result.groupId);
    if (!group || group.status !== 'open') {
      return res.status(403).json({ error: 'Diese Wahl ist derzeit nicht geöffnet' });
    }

    // Session-Cookie setzen (choice_session, getrennt vom Admin-JWT)
    const sessionToken = createChoiceSessionToken(result.participantId, result.groupId);
    res.cookie('choice_session', sessionToken, choiceCookieOptions());

    res.json({
      success: true,
      participantId: result.participantId,
      groupId: result.groupId,
    });
  } catch (err) {
    log.error({ err }, 'Verify-Fehler');
    res.status(500).json({ error: 'Fehler bei der Verifizierung' });
  }
});

// ── POST /request-access – Neuen Token anfordern ────────────────────

router.post('/request-access', validate(choiceRequestAccessSchema), async (req, res) => {
  try {
    // Generische Antwort IMMER – keine E-Mail-Enumeration
    const genericResponse = {
      success: true,
      message: 'Falls die E-Mail-Adresse bekannt ist, wurde ein neuer Zugangslink gesendet.',
    };

    const { email, groupId } = req.body;

    // Gruppe prüfen
    const group = await choiceService.getGroupById(groupId);
    if (!group || group.status !== 'open') {
      return res.json(genericResponse);
    }

    // Teilnehmer suchen
    const participant = await db.selectFrom('choice_participants')
      .select(['id', 'first_name', 'last_name', 'email', 'is_active'])
      .where('group_id', '=', groupId)
      .where('email', '=', email)
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!participant) {
      return res.json(genericResponse);
    }

    // Alte Tokens invalidieren, neuen erstellen
    await invalidateTokensForParticipant(participant.id);
    const { token } = await createToken(participant.id);

    // E-Mail senden (fire-and-forget, Fehler nur loggen)
    sendInviteEmail(
      { email: participant.email, firstName: participant.first_name, lastName: participant.last_name },
      group,
      token,
    ).catch((err) => log.error({ err, email }, 'Request-Access E-Mail fehlgeschlagen'));

    res.json(genericResponse);
  } catch (err) {
    log.error({ err }, 'Request-Access-Fehler');
    res.status(500).json({ error: 'Fehler beim Anfordern des Zugangslinks' });
  }
});

// ── GET /groups/:id – Group + aktive Options (nur wenn open, Cookie nötig) ──

router.get('/groups/:id', requireChoiceSession, async (req, res) => {
  try {
    const groupId = req.params.id;

    // Session muss zur angefragten Gruppe gehören
    if (req.choiceSession.groupId !== groupId) {
      return res.status(403).json({ error: 'Kein Zugriff auf dieses Wahldach' });
    }

    const group = await choiceService.getGroupById(groupId);
    if (!group || group.status !== 'open') {
      return res.status(403).json({ error: 'Diese Wahl ist derzeit nicht geöffnet' });
    }

    // Zeitfenster prüfen
    const now = new Date();
    if (group.opens_at && new Date(group.opens_at) > now) {
      return res.status(403).json({ error: 'Die Wahl ist noch nicht geöffnet' });
    }
    if (group.closes_at && new Date(group.closes_at) < now) {
      return res.status(403).json({ error: 'Die Wahl ist bereits geschlossen' });
    }

    // Nur aktive Optionen zurückgeben
    const options = await db.selectFrom('choice_options')
      .select(['id', 'title', 'description', 'sort_order'])
      .where('group_id', '=', groupId)
      .where('is_active', '=', true)
      .orderBy('sort_order', 'asc')
      .orderBy('title', 'asc')
      .execute();

    res.json({
      id: group.id,
      title: group.title,
      description: group.description,
      min_choices: group.min_choices,
      max_choices: group.max_choices,
      ranking_mode: group.ranking_mode,
      options,
    });
  } catch (err) {
    log.error({ err }, 'Public Group-Abfrage-Fehler');
    res.status(500).json({ error: 'Fehler beim Laden der Wahldaten' });
  }
});

// ── GET /groups/:id/submission – Eigene Wahl laden ─────────────────

router.get('/groups/:id/submission', requireChoiceSession, async (req, res) => {
  try {
    const groupId = req.params.id;
    if (req.choiceSession.groupId !== groupId) {
      return res.status(403).json({ error: 'Kein Zugriff auf dieses Wahldach' });
    }

    const submission = await choiceService.getSubmission(groupId, req.choiceSession.participantId);
    res.json(submission || { status: 'none', items: [] });
  } catch (err) {
    log.error({ err }, 'Submission-Abfrage-Fehler');
    res.status(500).json({ error: 'Fehler beim Laden der Wahl' });
  }
});

// ── PUT /groups/:id/submission/draft – Entwurf speichern ───────────

router.put('/groups/:id/submission/draft', requireChoiceSession, validate(choiceDraftSchema), async (req, res) => {
  try {
    const groupId = req.params.id;
    const { participantId } = req.choiceSession;

    if (req.choiceSession.groupId !== groupId) {
      return res.status(403).json({ error: 'Kein Zugriff auf dieses Wahldach' });
    }

    const access = await choiceService.validateSubmissionAccess(groupId, participantId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    // Items nur validieren wenn welche vorhanden (Draft darf leer sein)
    if (req.body.items.length > 0) {
      const activeOptionIds = await choiceService.getActiveOptionIds(groupId);
      const itemError = choiceService.validateItems(req.body.items, access.group, activeOptionIds);
      if (itemError) return res.status(400).json(itemError);
    }

    const submission = await choiceService.saveDraft(groupId, participantId, req.body.items, access.group);
    res.json(submission);
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message });
    }
    log.error({ err }, 'Draft-Speicher-Fehler');
    res.status(500).json({ error: 'Fehler beim Speichern des Entwurfs' });
  }
});

// ── POST /groups/:id/submission/submit – Wahl abgeben ──────────────

router.post('/groups/:id/submission/submit', requireChoiceSession, validate(choiceSubmitSchema), async (req, res) => {
  try {
    const groupId = req.params.id;
    const { participantId } = req.choiceSession;

    if (req.choiceSession.groupId !== groupId) {
      return res.status(403).json({ error: 'Kein Zugriff auf dieses Wahldach' });
    }

    const access = await choiceService.validateSubmissionAccess(groupId, participantId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const activeOptionIds = await choiceService.getActiveOptionIds(groupId);
    const itemError = choiceService.validateItems(req.body.items, access.group, activeOptionIds);
    if (itemError) return res.status(400).json(itemError);

    const submission = await choiceService.submitChoices(groupId, participantId, req.body.items, access.group);
    res.json(submission);
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message });
    }
    log.error({ err }, 'Submit-Fehler');
    res.status(500).json({ error: 'Fehler beim Abgeben der Wahl' });
  }
});

export default router;
