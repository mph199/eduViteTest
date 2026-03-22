import { Router } from 'express';
import * as flowService from '../services/flowService.js';
import logger from '../../../config/logger.js';

const router = Router();

// GET /arbeitspakete – Aggregierte Uebersicht (nur Name, Status, Deadline)
router.get('/arbeitspakete', async (req, res) => {
    try {
        const pakete = await flowService.getAbteilungsUebersicht();
        res.json(pakete);
    } catch (err) {
        logger.error({ err }, 'flow abteilung: Fehler beim Laden der Abteilungsuebersicht');
        res.status(500).json({ error: 'Fehler beim Laden der Abteilungsuebersicht' });
    }
});

export default router;
