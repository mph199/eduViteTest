import { Router } from 'express';
import { query } from '../../../config/db.js';
import * as flowService from '../services/flowService.js';
import { writeAuditLog } from '../../../middleware/audit-log.js';
import logger from '../../../config/logger.js';

// Alle Routen dieses Routers werden ueber app.use mit
// requireAuth + requireAdmin + requireModuleAccess('flow') geschuetzt (siehe index.js).
const router = Router();

function parseId(value) {
    const n = parseInt(value, 10);
    return isNaN(n) ? null : n;
}

// ── Verfuegbare User fuer Zuweisung ──

router.get('/users', async (_req, res) => {
    try {
        const result = await query(
            `SELECT u.id, u.username,
                    COALESCE(t.first_name, '') AS vorname,
                    COALESCE(t.last_name, u.username) AS nachname,
                    u.role
             FROM users u
             LEFT JOIN teachers t ON t.id = u.teacher_id
             WHERE u.role IN ('teacher', 'admin', 'superadmin')
             ORDER BY t.last_name NULLS LAST, t.first_name NULLS LAST, u.username`
        );
        res.json(result.rows);
    } catch (err) {
        logger.error({ err }, 'Fehler beim Laden der User');
        res.status(500).json({ error: 'Fehler beim Laden der User' });
    }
});

// ── Bildungsgaenge verwalten ──

// GET / – Alle Bildungsgaenge (Admin-Uebersicht)
router.get('/bildungsgaenge', async (_req, res) => {
    try {
        const bildungsgaenge = await flowService.getAllBildungsgaenge();
        res.json(bildungsgaenge);
    } catch (err) {
        logger.error({ err }, 'Fehler beim Laden aller Bildungsgaenge');
        res.status(500).json({ error: 'Fehler beim Laden der Bildungsgaenge' });
    }
});

// POST / – Neuen Bildungsgang anlegen
router.post('/bildungsgaenge', async (req, res) => {
    try {
        const { name, erlaubtMitgliedernPaketErstellung } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name ist erforderlich' });
        }
        const bg = await flowService.createBildungsgang(name.trim(), !!erlaubtMitgliedernPaketErstellung);
        res.status(201).json(bg);
    } catch (err) {
        logger.error({ err }, 'Fehler beim Erstellen des Bildungsgangs');
        res.status(500).json({ error: 'Fehler beim Erstellen des Bildungsgangs' });
    }
});

// ── Bildungsgang-Mitglieder verwalten ──

// GET /:id/mitglieder – Mitglieder eines Bildungsgangs
router.get('/bildungsgaenge/:id/mitglieder', async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'Ungueltige ID' });
        const mitglieder = await flowService.getBildungsgangMitglieder(id);
        res.json(mitglieder);
    } catch (err) {
        logger.error({ err }, 'Fehler beim Laden der Mitglieder');
        res.status(500).json({ error: 'Fehler beim Laden der Mitglieder' });
    }
});

// POST /:id/mitglieder – Mitglied hinzufuegen
router.post('/bildungsgaenge/:id/mitglieder', async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'Ungueltige ID' });

        const { userId, rolle } = req.body;
        const uid = parseId(userId);
        if (!uid || !rolle) {
            return res.status(400).json({ error: 'userId und rolle sind erforderlich' });
        }
        if (!['leitung', 'mitglied'].includes(rolle)) {
            return res.status(400).json({ error: 'Rolle muss leitung oder mitglied sein' });
        }

        // Sicherstellen dass der User existiert und eine erlaubte Rolle hat
        const userCheck = await query(
            `SELECT id FROM users WHERE id = $1 AND role IN ('teacher', 'admin', 'superadmin')`,
            [uid]
        );
        if (userCheck.rows.length === 0) {
            return res.status(400).json({ error: 'User nicht gefunden oder nicht berechtigt' });
        }

        const mitglied = await flowService.addBildungsgangMitglied(id, uid, rolle);
        if (!mitglied) {
            return res.status(409).json({ error: 'User ist bereits Mitglied dieses Bildungsgangs' });
        }

        // Sicherstellen, dass der User Zugang zum Flow-Modul hat
        await query(
            `INSERT INTO user_module_access (user_id, module_key)
             VALUES ($1, 'flow')
             ON CONFLICT (user_id, module_key) DO NOTHING`,
            [uid]
        );

        // Token-Version inkrementieren, damit der User beim naechsten Verify
        // die aktualisierte Modulliste erhaelt
        await query(
            `UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = $1`,
            [uid]
        );

        writeAuditLog(req.user.id, 'FLOW_BG_MITGLIED_ADDED', 'flow_bildungsgang_mitglied', mitglied.id, { bildungsgangId: id, userId: uid, rolle }, req.ip);
        res.status(201).json(mitglied);
    } catch (err) {
        logger.error({ err }, 'Fehler beim Hinzufuegen des Mitglieds');
        res.status(500).json({ error: 'Fehler beim Hinzufuegen des Mitglieds' });
    }
});

// PATCH /:id/mitglieder/:uid – Rolle aendern
router.patch('/bildungsgaenge/:id/mitglieder/:uid', async (req, res) => {
    try {
        const id = parseId(req.params.id);
        const uid = parseId(req.params.uid);
        if (!id || !uid) return res.status(400).json({ error: 'Ungueltige ID' });

        const { rolle } = req.body;
        if (!rolle || !['leitung', 'mitglied'].includes(rolle)) {
            return res.status(400).json({ error: 'Rolle muss leitung oder mitglied sein' });
        }
        const updated = await flowService.updateBildungsgangMitgliedRolle(id, uid, rolle);
        if (!updated) {
            return res.status(404).json({ error: 'Mitglied nicht gefunden' });
        }
        writeAuditLog(req.user.id, 'FLOW_BG_MITGLIED_ROLE_CHANGED', 'flow_bildungsgang_mitglied', updated.id, { bildungsgangId: id, userId: uid, rolle }, req.ip);
        res.json(updated);
    } catch (err) {
        logger.error({ err }, 'Fehler beim Aendern der Rolle');
        res.status(500).json({ error: 'Fehler beim Aendern der Rolle' });
    }
});

// DELETE /:id/mitglieder/:uid – Mitglied entfernen
router.delete('/bildungsgaenge/:id/mitglieder/:uid', async (req, res) => {
    try {
        const id = parseId(req.params.id);
        const uid = parseId(req.params.uid);
        if (!id || !uid) return res.status(400).json({ error: 'Ungueltige ID' });

        const removed = await flowService.removeBildungsgangMitglied(id, uid);
        if (!removed) {
            return res.status(404).json({ error: 'Mitglied nicht gefunden' });
        }

        // Pruefen ob der User noch in anderen Bildungsgaengen ist
        const remaining = await query(
            `SELECT 1 FROM flow_bildungsgang_mitglied WHERE user_id = $1 LIMIT 1`,
            [uid]
        );
        if (remaining.rows.length === 0) {
            // Kein BG-Zugehörigkeit mehr → Flow-Modulzugang entfernen
            await query(
                `DELETE FROM user_module_access WHERE user_id = $1 AND module_key = 'flow'`,
                [uid]
            );
        }

        // Token-Version inkrementieren
        await query(
            `UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = $1`,
            [uid]
        );

        writeAuditLog(req.user.id, 'FLOW_BG_MITGLIED_REMOVED', 'flow_bildungsgang_mitglied', null, { bildungsgangId: id, userId: uid }, req.ip);
        res.status(204).end();
    } catch (err) {
        logger.error({ err }, 'Fehler beim Entfernen des Mitglieds');
        res.status(500).json({ error: 'Fehler beim Entfernen des Mitglieds' });
    }
});

export default router;
