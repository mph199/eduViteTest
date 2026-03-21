import { Router } from 'express';
import { query } from '../../../config/db.js';
import * as flowService from '../services/flowService.js';
import { writeAuditLog } from '../../../middleware/audit-log.js';
import logger from '../../../config/logger.js';

const router = Router();

// DELETE /:id – Datei loeschen (nur Paket-Mitglieder mit koordination/mitwirkende)
router.delete('/:id', async (req, res) => {
    try {
        const dateiId = parseInt(req.params.id, 10);
        if (isNaN(dateiId)) return res.status(400).json({ error: 'Ungueltige Datei-ID' });

        // Pruefen ob die Datei existiert und zu welchem Arbeitspaket sie gehoert
        const dateiResult = await query(
            'SELECT arbeitspaket_id FROM flow_datei WHERE id = $1',
            [dateiId]
        );
        if (dateiResult.rows.length === 0) {
            return res.status(404).json({ error: 'Datei nicht gefunden' });
        }

        const paketId = dateiResult.rows[0].arbeitspaket_id;

        // Pruefen ob der User Mitglied des Arbeitspakets ist (koordination oder mitwirkende)
        const mitgliedResult = await query(
            `SELECT rolle FROM flow_arbeitspaket_mitglied
             WHERE arbeitspaket_id = $1 AND user_id = $2`,
            [paketId, req.user.id]
        );

        const rolle = mitgliedResult.rows[0]?.rolle;

        if (!rolle || rolle === 'lesezugriff') {
            return res.status(403).json({ error: 'Keine Berechtigung zum Loeschen von Dateien' });
        }

        await flowService.deleteDatei(dateiId);
        writeAuditLog(req.user.id, 'FLOW_DATEI_DELETED', 'flow_datei', dateiId, { paketId }, req.ip);
        res.status(204).end();
    } catch (err) {
        logger.error({ err }, 'Fehler beim Loeschen der Datei');
        res.status(500).json({ error: 'Fehler beim Loeschen der Datei' });
    }
});

export default router;
