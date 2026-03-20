import { Router } from 'express';
import * as flowService from '../services/flowService.js';

const router = Router();

// DELETE /:id – Datei loeschen
router.delete('/:id', async (req, res) => {
    try {
        await flowService.deleteDatei(parseInt(req.params.id));
        res.status(204).end();
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Loeschen der Datei' });
    }
});

export default router;
