import { Router } from 'express';
import { requireFlowBildungsgangRolle, requireFlowPaketAnlage } from '../middleware/flowAuth.js';
import * as flowService from '../services/flowService.js';

const router = Router();

// GET / – Eigene Bildungsgaenge
router.get('/', async (req, res) => {
    try {
        const bildungsgaenge = await flowService.getBildungsgaengeForUser(req.user.id);
        res.json(bildungsgaenge);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Laden der Bildungsgaenge' });
    }
});

// GET /:id – Bildungsgang-Detail
router.get('/:id', requireFlowBildungsgangRolle('mitglied'), async (req, res) => {
    try {
        const detail = await flowService.getBildungsgangDetail(parseInt(req.params.id));
        if (!detail) return res.status(404).json({ error: 'Bildungsgang nicht gefunden' });
        res.json(detail);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Laden des Bildungsgangs' });
    }
});

// POST /:id/arbeitspakete – Neues Arbeitspaket
router.post('/:id/arbeitspakete', requireFlowPaketAnlage, async (req, res) => {
    try {
        const { titel, istZustand, sollZustand, beteiligteBeschreibung } = req.body;
        if (!titel || !istZustand || !sollZustand || !beteiligteBeschreibung) {
            return res.status(400).json({
                error: 'Pflichtfelder: titel, istZustand, sollZustand, beteiligteBeschreibung'
            });
        }
        const paket = await flowService.createArbeitspaket(
            parseInt(req.params.id), req.body, req.user.id
        );
        res.status(201).json(paket);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Erstellen des Arbeitspakets' });
    }
});

export default router;
