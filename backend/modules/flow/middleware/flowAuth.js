import { db } from '../../../db/database.js';
import { sql } from 'kysely';
import { assertSafeIdentifier } from '../../../shared/sqlGuards.js';
import logger from '../../../config/logger.js';

const BG_ROLLEN_HIERARCHIE = { leitung: 2, mitglied: 1 };

/**
 * Prueft Bildungsgang-Mitgliedschaft mit Mindestrolle.
 * Admin/Superadmin erhalten implizite Leitung.
 * Setzt req.flowBgRolle.
 */
export function requireFlowBildungsgangRolle(minRolle) {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            const bildungsgangId = req.params.bildungsgangId || req.params.id;

            const row = await db.selectFrom('flow_bildungsgang_mitglied')
                .select('rolle')
                .where('bildungsgang_id', '=', bildungsgangId)
                .where('user_id', '=', userId)
                .executeTakeFirst();

            if (!row) {
                if (['admin', 'superadmin'].includes(req.user.role)) {
                    req.flowBgRolle = 'leitung';
                    return next();
                }
                return res.status(403).json({ error: 'Kein Zugang zu diesem Bildungsgang' });
            }

            const rolle = row.rolle;
            if (!(BG_ROLLEN_HIERARCHIE[rolle] >= BG_ROLLEN_HIERARCHIE[minRolle])) {
                return res.status(403).json({ error: 'Bildungsgangleitung erforderlich' });
            }

            req.flowBgRolle = rolle;
            next();
        } catch (err) {
            logger.error({ err }, 'flowAuth: Fehler bei der Berechtigungspruefung');
            return res.status(500).json({ error: 'Fehler bei der Berechtigungspruefung' });
        }
    };
}

/**
 * Prueft Arbeitspaket-Mitgliedschaft mit erlaubten Rollen.
 * KEIN Admin-Bypass – bewusste Entscheidung fuer Datensparsamkeit.
 * Setzt req.flowPaketRolle.
 */
export function requireFlowPaketRolle(erlaubteRollen) {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            const arbeitspaketId = req.params.arbeitspaketId || req.params.id;

            const row = await db.selectFrom('flow_arbeitspaket_mitglied')
                .select('rolle')
                .where('arbeitspaket_id', '=', arbeitspaketId)
                .where('user_id', '=', userId)
                .executeTakeFirst();

            if (!row) {
                return res.status(403).json({ error: 'Kein Zugang zu diesem Arbeitspaket' });
            }

            const rolle = row.rolle;
            if (!erlaubteRollen.includes(rolle)) {
                return res.status(403).json({ error: 'Unzureichende Berechtigung' });
            }

            req.flowPaketRolle = rolle;
            next();
        } catch (err) {
            logger.error({ err }, 'flowAuth: Fehler bei der Berechtigungspruefung');
            return res.status(500).json({ error: 'Fehler bei der Berechtigungspruefung' });
        }
    };
}

/**
 * Prueft Abteilungsleitung ueber dedizierte Tabelle.
 * Superadmin hat immer Zugriff.
 */
export async function requireFlowAbteilungsleitung(req, res, next) {
    try {
        if (['admin', 'superadmin'].includes(req.user.role)) return next();

        const row = await db.selectFrom('flow_abteilungsleitung')
            .select(sql`1`.as('exists'))
            .where('user_id', '=', req.user.id)
            .executeTakeFirst();

        if (!row) {
            return res.status(403).json({ error: 'Nur fuer Abteilungsleitung' });
        }

        next();
    } catch (err) {
        logger.error({ err }, 'flowAuth requireFlowAbteilungsleitung error');
        return res.status(500).json({ error: 'Fehler bei der Berechtigungspruefung' });
    }
}

/**
 * Prueft ob User Arbeitspakete im Bildungsgang anlegen darf.
 * Leitung immer, Mitglieder nur wenn erlaubt_mitgliedern_paket_erstellung.
 * Admin/Superadmin Bypass.
 */
export async function requireFlowPaketAnlage(req, res, next) {
    try {
        const userId = req.user.id;
        const bildungsgangId = req.params.bildungsgangId || req.params.id;

        if (['admin', 'superadmin'].includes(req.user.role)) {
            return next();
        }

        const row = await db.selectFrom('flow_bildungsgang_mitglied as bgm')
            .innerJoin('flow_bildungsgang as bg', 'bg.id', 'bgm.bildungsgang_id')
            .select(['bgm.rolle', 'bg.erlaubt_mitgliedern_paket_erstellung'])
            .where('bgm.bildungsgang_id', '=', bildungsgangId)
            .where('bgm.user_id', '=', userId)
            .executeTakeFirst();

        if (!row) {
            return res.status(403).json({ error: 'Kein Mitglied des Bildungsgangs' });
        }

        const { rolle, erlaubt_mitgliedern_paket_erstellung } = row;

        if (rolle === 'leitung') return next();
        if (rolle === 'mitglied' && erlaubt_mitgliedern_paket_erstellung) return next();

        return res.status(403).json({ error: 'Keine Berechtigung zur Paketanlage' });
    } catch (err) {
        logger.error({ err }, 'flowAuth requireFlowPaketAnlage error');
        return res.status(500).json({ error: 'Fehler bei der Berechtigungspruefung' });
    }
}

/**
 * Generische Middleware: Ermittelt die Arbeitspaket-ID ueber eine Lookup-Tabelle
 * und prueft Paket-Mitgliedschaft.
 * Setzt req.flowPaketRolle.
 * @param {string} entityTable - Quelltabelle (flow_aufgabe oder flow_tagung)
 * @param {string} entityLabel - Label fuer Fehlermeldungen
 * @param {Function} storeResult - (req, arbeitspaketId) => void
 */
function requireFlowEntityZugang(entityTable, entityLabel, storeResult) {
    assertSafeIdentifier(entityTable, 'entityTable');
    return (erlaubteRollen) => {
        return async (req, res, next) => {
            try {
                const entityRow = await db.selectFrom(entityTable)
                    .select('arbeitspaket_id')
                    .where('id', '=', req.params.id)
                    .executeTakeFirst();

                if (!entityRow) {
                    return res.status(404).json({ error: `${entityLabel} nicht gefunden` });
                }
                const arbeitspaketId = entityRow.arbeitspaket_id;
                storeResult(req, arbeitspaketId);

                const row = await db.selectFrom('flow_arbeitspaket_mitglied')
                    .select('rolle')
                    .where('arbeitspaket_id', '=', arbeitspaketId)
                    .where('user_id', '=', req.user.id)
                    .executeTakeFirst();

                if (!row) {
                    return res.status(403).json({ error: 'Kein Zugang zu diesem Arbeitspaket' });
                }
                const rolle = row.rolle;
                if (!erlaubteRollen.includes(rolle)) {
                    return res.status(403).json({ error: 'Unzureichende Berechtigung' });
                }
                req.flowPaketRolle = rolle;
                next();
            } catch (err) {
                logger.error({ err }, `flowAuth requireFlowEntityZugang(${entityTable}) error`);
                return res.status(500).json({ error: 'Fehler bei der Berechtigungspruefung' });
            }
        };
    };
}

/**
 * Ermittelt die Arbeitspaket-ID aus einer Aufgabe und prueft Paket-Mitgliedschaft.
 * Setzt req.flowPaketRolle und req.params.arbeitspaketId.
 */
export const requireFlowAufgabeZugang = requireFlowEntityZugang(
    'flow_aufgabe', 'Aufgabe',
    (req, id) => { req.params.arbeitspaketId = String(id); }
);

/**
 * Ermittelt die Arbeitspaket-ID aus einer Tagung und prueft Paket-Mitgliedschaft.
 * Setzt req.flowPaketRolle und req.flowTagungPaketId.
 */
export const requireFlowTagungZugang = requireFlowEntityZugang(
    'flow_tagung', 'Tagung',
    (req, id) => { req.flowTagungPaketId = id; }
);

/**
 * Prueft Aufgaben-Erstellungsberechtigung.
 * Koordination darf alles. Mitwirkende duerfen ohne Tagung-Kontext nur sich selbst zuweisen.
 * Muss NACH requireFlowPaketRolle aufgerufen werden (req.flowPaketRolle).
 */
export function requireFlowAufgabeErstellen(req, res, next) {
    const rolle = req.flowPaketRolle;
    const { zustaendig, tagungId } = req.body;

    if (rolle === 'koordination') return next();

    if (rolle === 'mitwirkende') {
        if (!tagungId && parseInt(zustaendig, 10) !== req.user.id) {
            return res.status(403).json({
                error: 'Mitwirkende duerfen ausserhalb von Tagungen nur sich selbst Aufgaben zuweisen'
            });
        }
        return next();
    }

    return res.status(403).json({ error: 'Keine Berechtigung' });
}
