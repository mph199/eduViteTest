import { query } from '../../../config/db.js';
import { assertSafeIdentifier } from '../../../shared/sqlGuards.js';

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

            const result = await query(
                'SELECT rolle FROM flow_bildungsgang_mitglied WHERE bildungsgang_id = $1 AND user_id = $2',
                [bildungsgangId, userId]
            );

            if (result.rows.length === 0) {
                if (['admin', 'superadmin'].includes(req.user.role)) {
                    req.flowBgRolle = 'leitung';
                    return next();
                }
                return res.status(403).json({ error: 'Kein Zugang zu diesem Bildungsgang' });
            }

            const rolle = result.rows[0].rolle;
            if (!(BG_ROLLEN_HIERARCHIE[rolle] >= BG_ROLLEN_HIERARCHIE[minRolle])) {
                return res.status(403).json({ error: 'Bildungsgangleitung erforderlich' });
            }

            req.flowBgRolle = rolle;
            next();
        } catch (err) {
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

            const result = await query(
                'SELECT rolle FROM flow_arbeitspaket_mitglied WHERE arbeitspaket_id = $1 AND user_id = $2',
                [arbeitspaketId, userId]
            );

            if (result.rows.length === 0) {
                return res.status(403).json({ error: 'Kein Zugang zu diesem Arbeitspaket' });
            }

            const rolle = result.rows[0].rolle;
            if (!erlaubteRollen.includes(rolle)) {
                return res.status(403).json({ error: 'Unzureichende Berechtigung' });
            }

            req.flowPaketRolle = rolle;
            next();
        } catch (err) {
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

        const result = await query(
            'SELECT 1 FROM flow_abteilungsleitung WHERE user_id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Nur fuer Abteilungsleitung' });
        }

        next();
    } catch (err) {
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

        const bgResult = await query(
            `SELECT bgm.rolle, bg.erlaubt_mitgliedern_paket_erstellung
             FROM flow_bildungsgang_mitglied bgm
             JOIN flow_bildungsgang bg ON bg.id = bgm.bildungsgang_id
             WHERE bgm.bildungsgang_id = $1 AND bgm.user_id = $2`,
            [bildungsgangId, userId]
        );

        if (bgResult.rows.length === 0) {
            return res.status(403).json({ error: 'Kein Mitglied des Bildungsgangs' });
        }

        const { rolle, erlaubt_mitgliedern_paket_erstellung } = bgResult.rows[0];

        if (rolle === 'leitung') return next();
        if (rolle === 'mitglied' && erlaubt_mitgliedern_paket_erstellung) return next();

        return res.status(403).json({ error: 'Keine Berechtigung zur Paketanlage' });
    } catch (err) {
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
                const entityResult = await query(
                    `SELECT arbeitspaket_id FROM ${entityTable} WHERE id = $1`,
                    [req.params.id]
                );
                if (entityResult.rows.length === 0) {
                    return res.status(404).json({ error: `${entityLabel} nicht gefunden` });
                }
                const arbeitspaketId = entityResult.rows[0].arbeitspaket_id;
                storeResult(req, arbeitspaketId);

                const result = await query(
                    'SELECT rolle FROM flow_arbeitspaket_mitglied WHERE arbeitspaket_id = $1 AND user_id = $2',
                    [arbeitspaketId, req.user.id]
                );
                if (result.rows.length === 0) {
                    return res.status(403).json({ error: 'Kein Zugang zu diesem Arbeitspaket' });
                }
                const rolle = result.rows[0].rolle;
                if (!erlaubteRollen.includes(rolle)) {
                    return res.status(403).json({ error: 'Unzureichende Berechtigung' });
                }
                req.flowPaketRolle = rolle;
                next();
            } catch (err) {
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
        if (!tagungId && zustaendig !== req.user.id) {
            return res.status(403).json({
                error: 'Mitwirkende duerfen ausserhalb von Tagungen nur sich selbst Aufgaben zuweisen'
            });
        }
        return next();
    }

    return res.status(403).json({ error: 'Keine Berechtigung' });
}
