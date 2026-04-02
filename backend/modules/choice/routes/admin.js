/**
 * Choice-Modul – Admin-Routen
 *
 * CRUD fuer Groups und Options (Phase 1).
 * Auth via requireModuleAdmin('choice') im Modul-Manifest.
 */

import { Router } from 'express';
import { validate } from '../../../middleware/validate.js';
import {
  choiceGroupCreateSchema,
  choiceGroupUpdateSchema,
  choiceGroupStatusSchema,
  choiceOptionCreateSchema,
  choiceOptionUpdateSchema,
} from '../../../schemas/choice.js';
import * as choiceService from '../services/choiceService.js';

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

export default router;
