import { Router } from 'express';
import { requireFlowTagungZugang } from '../middleware/flowAuth.js';
import * as flowService from '../services/flowService.js';

const router = Router();

const ALLE = ['koordination', 'mitwirkende', 'lesezugriff'];
const SCHREIBEN = ['koordination', 'mitwirkende'];
const NUR_KOORDINATION = ['koordination'];

// GET /:id – Tagung-Detail
router.get('/:id', requireFlowTagungZugang(ALLE), async (req, res) => {
    try {
        const tagung = await flowService.getTagungDetail(parseInt(req.params.id));
        if (!tagung) return res.status(404).json({ error: 'Tagung nicht gefunden' });
        res.json(tagung);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Laden der Tagung' });
    }
});

// PATCH /:id – Tagung aktualisieren
router.patch('/:id', requireFlowTagungZugang(NUR_KOORDINATION), async (req, res) => {
    try {
        const tagung = await flowService.updateTagung(parseInt(req.params.id), req.body);
        if (!tagung) return res.status(404).json({ error: 'Tagung nicht gefunden' });
        res.json(tagung);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    }
});

// DELETE /:id
router.delete('/:id', requireFlowTagungZugang(NUR_KOORDINATION), async (req, res) => {
    try {
        await flowService.deleteTagung(parseInt(req.params.id));
        res.status(204).end();
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Loeschen' });
    }
});

// POST /:id/agenda – Agenda-Punkt hinzufuegen
router.post('/:id/agenda', requireFlowTagungZugang(SCHREIBEN), async (req, res) => {
    try {
        if (!req.body.titel || !req.body.titel.trim()) {
            return res.status(400).json({ error: 'Titel ist erforderlich' });
        }
        const punkt = await flowService.addAgendaPunkt(parseInt(req.params.id), req.body);
        res.status(201).json(punkt);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Erstellen des Agenda-Punkts' });
    }
});

// PATCH /:id/agenda/:aid – Agenda-Punkt dokumentieren
router.patch('/:id/agenda/:aid', requireFlowTagungZugang(SCHREIBEN), async (req, res) => {
    try {
        const punkt = await flowService.dokumentiereAgendaPunkt(parseInt(req.params.aid), req.body);
        if (!punkt) return res.status(404).json({ error: 'Agenda-Punkt nicht gefunden' });
        res.json(punkt);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Dokumentieren' });
    }
});

// POST /:id/agenda/:aid/aufgaben – Aufgabe aus Agenda-Punkt
router.post('/:id/agenda/:aid/aufgaben', requireFlowTagungZugang(SCHREIBEN), async (req, res) => {
    try {
        const tagungId = parseInt(req.params.id);
        const tagung = await flowService.getTagungDetail(tagungId);
        if (!tagung) return res.status(404).json({ error: 'Tagung nicht gefunden' });

        const aufgabe = await flowService.createAufgabe(
            tagung.arbeitspaketId,
            { ...req.body, tagungId },
            req.user.id
        );
        res.status(201).json(aufgabe);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Erstellen der Aufgabe' });
    }
});

export default router;
