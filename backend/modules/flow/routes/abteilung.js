import { Router } from 'express';
import * as flowService from '../services/flowService.js';

const router = Router();

// GET /arbeitspakete – Aggregierte Uebersicht (nur Name, Status, Deadline)
router.get('/arbeitspakete', async (req, res) => {
    try {
        const pakete = await flowService.getAbteilungsUebersicht();
        res.json(pakete);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Laden der Abteilungsuebersicht' });
    }
});

export default router;
