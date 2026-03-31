import { Router } from 'express';
import { db } from '../../../db/database.js';
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
        const dateiRow = await db.selectFrom('flow_datei')
            .select('arbeitspaket_id')
            .where('id', '=', dateiId)
            .executeTakeFirst();
        if (!dateiRow) {
            return res.status(404).json({ error: 'Datei nicht gefunden' });
        }

        const paketId = dateiRow.arbeitspaket_id;

        // Pruefen ob der User Mitglied des Arbeitspakets ist (koordination oder mitwirkende)
        const mitgliedRow = await db.selectFrom('flow_arbeitspaket_mitglied')
            .select('rolle')
            .where('arbeitspaket_id', '=', paketId)
            .where('user_id', '=', req.user.id)
            .executeTakeFirst();

        const rolle = mitgliedRow?.rolle;

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
