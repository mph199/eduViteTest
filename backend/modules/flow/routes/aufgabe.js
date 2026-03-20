import { Router } from 'express';
import { requireFlowAufgabeZugang } from '../middleware/flowAuth.js';
import * as flowService from '../services/flowService.js';

const router = Router();

const ALLE = ['koordination', 'mitwirkende', 'lesezugriff'];
const SCHREIBEN = ['koordination', 'mitwirkende'];

const ERLAUBTE_STATUS = ['offen', 'in_bearbeitung', 'erledigt'];

// GET /meine – Persoenliche Aufgaben (muss vor /:id stehen)
router.get('/meine', async (req, res) => {
    try {
        const filter = {};
        if (req.query.status) {
            if (!ERLAUBTE_STATUS.includes(req.query.status)) {
                return res.status(400).json({ error: 'Ungueltiger Status-Filter' });
            }
            filter.status = req.query.status;
        }
        if (req.query.ueberfaellig === 'true') filter.ueberfaellig = true;
        const aufgaben = await flowService.getMeineAufgaben(req.user.id, filter);
        res.json(aufgaben);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Laden der Aufgaben' });
    }
});

// PATCH /:id – Aufgabe aktualisieren
router.patch('/:id', requireFlowAufgabeZugang(SCHREIBEN), async (req, res) => {
    try {
        const aufgabe = await flowService.updateAufgabe(parseInt(req.params.id), req.body);
        if (!aufgabe) return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
        res.json(aufgabe);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    }
});

// PATCH /:id/status – Status aendern
router.patch('/:id/status', requireFlowAufgabeZugang(SCHREIBEN), async (req, res) => {
    try {
        if (!req.body.status || !ERLAUBTE_STATUS.includes(req.body.status)) {
            return res.status(400).json({ error: 'Ungueltiger Status' });
        }
        const aufgabe = await flowService.updateAufgabeStatus(
            parseInt(req.params.id), req.body.status, req.user.id
        );
        if (!aufgabe) return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
        res.json(aufgabe);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Statuswechsel' });
    }
});

// DELETE /:id
router.delete('/:id', requireFlowAufgabeZugang(SCHREIBEN), async (req, res) => {
    try {
        const aufgabe = await flowService.deleteAufgabe(parseInt(req.params.id), req.user.id);
        if (!aufgabe) return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
        res.status(204).end();
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Loeschen' });
    }
});

export default router;
