import { Router } from 'express';
import { db } from '../../../db/database.js';
import { sql } from 'kysely';
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
        const rows = await db.selectFrom('users as u')
            .leftJoin('teachers as t', 't.id', 'u.teacher_id')
            .select([
                'u.id', 'u.username',
                sql`COALESCE(t.first_name, '')`.as('vorname'),
                sql`COALESCE(t.last_name, u.username)`.as('nachname'),
                'u.role'
            ])
            .where('u.role', 'in', ['teacher', 'admin', 'superadmin'])
            .orderBy(sql`t.last_name NULLS LAST`)
            .orderBy(sql`t.first_name NULLS LAST`)
            .orderBy('u.username')
            .execute();
        res.json(rows);
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
        const userCheck = await db.selectFrom('users')
            .select('id')
            .where('id', '=', uid)
            .where('role', 'in', ['teacher', 'admin', 'superadmin'])
            .executeTakeFirst();
        if (!userCheck) {
            return res.status(400).json({ error: 'User nicht gefunden oder nicht berechtigt' });
        }

        const mitglied = await flowService.addBildungsgangMitglied(id, uid, rolle);
        if (!mitglied) {
            return res.status(409).json({ error: 'User ist bereits Mitglied dieses Bildungsgangs' });
        }

        // Sicherstellen, dass der User Zugang zum Flow-Modul hat
        await db.insertInto('user_module_access')
            .values({ user_id: uid, module_key: 'flow' })
            .onConflict((oc) => oc.columns(['user_id', 'module_key']).doNothing())
            .execute();

        // Token-Version inkrementieren, damit der User beim naechsten Verify
        // die aktualisierte Modulliste erhaelt
        await db.updateTable('users')
            .set({ token_version: sql`COALESCE(token_version, 0) + 1` })
            .where('id', '=', uid)
            .execute();

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
        const remaining = await db.selectFrom('flow_bildungsgang_mitglied')
            .select(sql`1`.as('exists'))
            .where('user_id', '=', uid)
            .limit(1)
            .executeTakeFirst();

        if (!remaining) {
            // Kein BG-Zugehoerigkeit mehr -> Flow-Modulzugang entfernen
            await db.deleteFrom('user_module_access')
                .where('user_id', '=', uid)
                .where('module_key', '=', 'flow')
                .execute();
        }

        // Token-Version inkrementieren
        await db.updateTable('users')
            .set({ token_version: sql`COALESCE(token_version, 0) + 1` })
            .where('id', '=', uid)
            .execute();

        writeAuditLog(req.user.id, 'FLOW_BG_MITGLIED_REMOVED', 'flow_bildungsgang_mitglied', null, { bildungsgangId: id, userId: uid }, req.ip);
        res.status(204).end();
    } catch (err) {
        logger.error({ err }, 'Fehler beim Entfernen des Mitglieds');
        res.status(500).json({ error: 'Fehler beim Entfernen des Mitglieds' });
    }
});

export default router;
