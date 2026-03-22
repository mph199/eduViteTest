import { Router } from 'express';
import * as flowService from '../services/flowService.js';
import logger from '../../../config/logger.js';

const router = Router();

// GET / – Aggregiertes persoenliches Dashboard
router.get('/', async (req, res) => {
    try {
        const dashboard = await flowService.getDashboardDaten(req.user.id);
        res.json(dashboard);
    } catch (err) {
        logger.error({ err }, 'flow dashboard: Fehler beim Laden des Dashboards');
        res.status(500).json({ error: 'Fehler beim Laden des Dashboards' });
    }
});

export default router;
