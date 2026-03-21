import { Router } from 'express';
import { requireFlowPaketRolle, requireFlowAufgabeErstellen } from '../middleware/flowAuth.js';
import * as flowService from '../services/flowService.js';
import { writeAuditLog } from '../../../middleware/audit-log.js';

const router = Router();

const ALLE = ['koordination', 'mitwirkende', 'lesezugriff'];
const SCHREIBEN = ['koordination', 'mitwirkende'];
const NUR_KOORDINATION = ['koordination'];

// GET /:id – Arbeitspaket-Detail
router.get('/:id', requireFlowPaketRolle(ALLE), async (req, res) => {
    try {
        const paket = await flowService.getArbeitspaketDetail(parseInt(req.params.id), req.user.id);
        if (!paket) return res.status(404).json({ error: 'Arbeitspaket nicht gefunden' });
        res.json(paket);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Laden des Arbeitspakets' });
    }
});

// PATCH /:id – Aktualisieren
router.patch('/:id', requireFlowPaketRolle(NUR_KOORDINATION), async (req, res) => {
    try {
        const { updatedAt, ...data } = req.body;
        const paket = await flowService.updateArbeitspaket(parseInt(req.params.id), data, updatedAt);
        if (!paket) return res.status(409).json({ error: 'Konflikt: Das Objekt wurde zwischenzeitlich geaendert' });
        res.json(paket);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    }
});

// PATCH /:id/status – Statusuebergang
router.patch('/:id/status', requireFlowPaketRolle(NUR_KOORDINATION), async (req, res) => {
    try {
        const result = await flowService.updateArbeitspaketStatus(
            parseInt(req.params.id), req.body.status, req.user.id
        );
        if (result.error) return res.status(400).json(result);
        res.json(result.paket);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Statusuebergang' });
    }
});

// DELETE /:id – Loeschen (nur Entwurf)
router.delete('/:id', requireFlowPaketRolle(NUR_KOORDINATION), async (req, res) => {
    try {
        const result = await flowService.deleteArbeitspaket(parseInt(req.params.id));
        if (result.error) return res.status(400).json(result);
        res.status(204).end();
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Loeschen' });
    }
});

// POST /:id/abschliessen – Abschluss
router.post('/:id/abschliessen', requireFlowPaketRolle(NUR_KOORDINATION), async (req, res) => {
    try {
        const paket = await flowService.abschliessenArbeitspaket(
            parseInt(req.params.id), req.body, req.user.id
        );
        if (!paket) return res.status(400).json({ error: 'Nur aktive Arbeitspakete koennen abgeschlossen werden' });
        res.json(paket);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Abschliessen' });
    }
});

// POST /:id/wiederaufnehmen – Wiederaufnahme
router.post('/:id/wiederaufnehmen', requireFlowPaketRolle(NUR_KOORDINATION), async (req, res) => {
    try {
        const paket = await flowService.wiederaufnehmenArbeitspaket(
            parseInt(req.params.id), req.user.id
        );
        if (!paket) return res.status(400).json({ error: 'Nur abgeschlossene Arbeitspakete koennen wiederaufgenommen werden' });
        res.json(paket);
    } catch (err) {
        res.status(500).json({ error: 'Fehler bei der Wiederaufnahme' });
    }
});

// ── Mitglieder ──

// GET /:id/mitglieder
router.get('/:id/mitglieder', requireFlowPaketRolle(ALLE), async (req, res) => {
    try {
        const mitglieder = await flowService.getMitglieder(parseInt(req.params.id));
        res.json(mitglieder);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Laden der Mitglieder' });
    }
});

const ERLAUBTE_AP_ROLLEN = ['koordination', 'mitwirkende', 'lesezugriff'];

// POST /:id/mitglieder
router.post('/:id/mitglieder', requireFlowPaketRolle(NUR_KOORDINATION), async (req, res) => {
    try {
        const userId = parseInt(req.body.userId, 10);
        const { rolle } = req.body;
        if (isNaN(userId) || !rolle) {
            return res.status(400).json({ error: 'userId und rolle sind erforderlich' });
        }
        if (!ERLAUBTE_AP_ROLLEN.includes(rolle)) {
            return res.status(400).json({ error: 'Rolle muss koordination, mitwirkende oder lesezugriff sein' });
        }
        const mitglied = await flowService.addMitglied(
            parseInt(req.params.id), userId, rolle, req.user.id
        );
        if (!mitglied) return res.status(409).json({ error: 'Mitglied existiert bereits' });
        writeAuditLog(req.user.id, 'FLOW_MITGLIED_ADDED', 'flow_arbeitspaket_mitglied', mitglied.id, { paketId: parseInt(req.params.id), userId, rolle }, req.ip);
        res.status(201).json(mitglied);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Hinzufuegen' });
    }
});

// PATCH /:id/mitglieder/:uid
router.patch('/:id/mitglieder/:uid', requireFlowPaketRolle(NUR_KOORDINATION), async (req, res) => {
    try {
        const { rolle } = req.body;
        if (!rolle || !ERLAUBTE_AP_ROLLEN.includes(rolle)) {
            return res.status(400).json({ error: 'Rolle muss koordination, mitwirkende oder lesezugriff sein' });
        }
        const mitglied = await flowService.updateMitgliedRolle(
            parseInt(req.params.id), parseInt(req.params.uid), rolle, req.user.id
        );
        if (!mitglied) return res.status(404).json({ error: 'Mitglied nicht gefunden' });
        writeAuditLog(req.user.id, 'FLOW_MITGLIED_ROLE_CHANGED', 'flow_arbeitspaket_mitglied', mitglied.id, { paketId: parseInt(req.params.id), userId: parseInt(req.params.uid), rolle }, req.ip);
        res.json(mitglied);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Aendern der Rolle' });
    }
});

// DELETE /:id/mitglieder/:uid
router.delete('/:id/mitglieder/:uid', requireFlowPaketRolle(NUR_KOORDINATION), async (req, res) => {
    try {
        const mitglied = await flowService.removeMitglied(
            parseInt(req.params.id), parseInt(req.params.uid), req.user.id
        );
        if (!mitglied) return res.status(404).json({ error: 'Mitglied nicht gefunden' });
        writeAuditLog(req.user.id, 'FLOW_MITGLIED_REMOVED', 'flow_arbeitspaket_mitglied', null, { paketId: parseInt(req.params.id), userId: parseInt(req.params.uid) }, req.ip);
        res.status(204).end();
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Entfernen' });
    }
});

// ── Aufgaben (Sub-Ressource) ──

// GET /:id/aufgaben
router.get('/:id/aufgaben', requireFlowPaketRolle(ALLE), async (req, res) => {
    try {
        const aufgaben = await flowService.getAufgaben(parseInt(req.params.id));
        res.json(aufgaben);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Laden der Aufgaben' });
    }
});

// POST /:id/aufgaben
router.post('/:id/aufgaben', requireFlowPaketRolle(SCHREIBEN), requireFlowAufgabeErstellen, async (req, res) => {
    try {
        if (!req.body.titel) {
            return res.status(400).json({ error: 'Titel ist erforderlich' });
        }
        const aufgabe = await flowService.createAufgabe(
            parseInt(req.params.id), req.body, req.user.id
        );
        res.status(201).json(aufgabe);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Erstellen der Aufgabe' });
    }
});

// ── Tagungen (Sub-Ressource) ──

// GET /:id/tagungen
router.get('/:id/tagungen', requireFlowPaketRolle(ALLE), async (req, res) => {
    try {
        const tagungen = await flowService.getTagungen(parseInt(req.params.id));
        res.json(tagungen);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Laden der Tagungen' });
    }
});

// POST /:id/tagungen
router.post('/:id/tagungen', requireFlowPaketRolle(NUR_KOORDINATION), async (req, res) => {
    try {
        if (!req.body.titel || !req.body.startAt) {
            return res.status(400).json({ error: 'Titel und Startzeit sind erforderlich' });
        }
        const tagung = await flowService.createTagung(
            parseInt(req.params.id), req.body, req.user.id
        );
        res.status(201).json(tagung);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Erstellen der Tagung' });
    }
});

// ── Dateien ──

// GET /:id/dateien
router.get('/:id/dateien', requireFlowPaketRolle(ALLE), async (req, res) => {
    try {
        const dateien = await flowService.getDateien(parseInt(req.params.id));
        res.json(dateien);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Laden der Dateien' });
    }
});

// POST /:id/dateien
router.post('/:id/dateien', requireFlowPaketRolle(SCHREIBEN), async (req, res) => {
    try {
        if (req.body.externalUrl && !/^https?:\/\//i.test(req.body.externalUrl)) {
            return res.status(400).json({ error: 'Nur http:// und https:// URLs sind erlaubt' });
        }
        const datei = await flowService.addDateiMetadaten(
            parseInt(req.params.id), req.body, req.user.id
        );
        res.status(201).json(datei);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Speichern der Datei-Metadaten' });
    }
});

// ── Aktivitaeten ──

// GET /:id/aktivitaeten
router.get('/:id/aktivitaeten', requireFlowPaketRolle(ALLE), async (req, res) => {
    try {
        const aktivitaeten = await flowService.getAktivitaeten(parseInt(req.params.id));
        res.json(aktivitaeten);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Laden der Aktivitaeten' });
    }
});

export default router;
