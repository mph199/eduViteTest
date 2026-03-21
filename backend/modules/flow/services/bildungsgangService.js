import { query } from '../../../config/db.js';
import { mapRow, mapRows } from './flowHelpers.js';

// ── Bildungsgang ──

export async function getBildungsgaengeForUser(userId) {
    const result = await query(
        `SELECT bg.*, bgm.rolle AS meine_rolle,
                (SELECT COUNT(*) FROM flow_arbeitspaket WHERE bildungsgang_id = bg.id) AS arbeitspakete_count
         FROM flow_bildungsgang bg
         JOIN flow_bildungsgang_mitglied bgm ON bgm.bildungsgang_id = bg.id
         WHERE bgm.user_id = $1
         ORDER BY bg.name`,
        [userId]
    );
    return mapRows(result.rows);
}

export async function getBildungsgangDetail(bildungsgangId) {
    const bgResult = await query(
        'SELECT * FROM flow_bildungsgang WHERE id = $1',
        [bildungsgangId]
    );
    if (bgResult.rows.length === 0) return null;

    const mitgliederResult = await query(
        `SELECT bgm.id, bgm.user_id,
                COALESCE(t.first_name, '') AS vorname,
                COALESCE(t.last_name, u.username) AS nachname,
                bgm.rolle, bgm.hinzugefuegt_am
         FROM flow_bildungsgang_mitglied bgm
         JOIN users u ON u.id = bgm.user_id
         LEFT JOIN teachers t ON t.id = u.teacher_id
         WHERE bgm.bildungsgang_id = $1 AND bgm.restricted IS NOT TRUE
         ORDER BY bgm.rolle DESC, t.last_name NULLS LAST`,
        [bildungsgangId]
    );

    const paketeResult = await query(
        `SELECT ap.id, ap.titel, ap.status, ap.deadline,
                (SELECT COUNT(*) FILTER (WHERE status = 'erledigt') FROM flow_aufgabe WHERE arbeitspaket_id = ap.id) AS erledigt,
                (SELECT COUNT(*) FROM flow_aufgabe WHERE arbeitspaket_id = ap.id) AS gesamt
         FROM flow_arbeitspaket ap
         WHERE ap.bildungsgang_id = $1
         ORDER BY ap.created_at DESC`,
        [bildungsgangId]
    );

    return {
        ...mapRow(bgResult.rows[0]),
        mitglieder: mapRows(mitgliederResult.rows),
        arbeitspakete: paketeResult.rows.map(p => {
            const mapped = mapRow(p);
            return { ...mapped, fortschritt: { erledigt: parseInt(p.erledigt), gesamt: parseInt(p.gesamt) } };
        })
    };
}

// ── Bildungsgang Admin ──

export async function getAllBildungsgaenge() {
    const result = await query(
        `SELECT bg.*,
                (SELECT COUNT(*) FROM flow_bildungsgang_mitglied WHERE bildungsgang_id = bg.id) AS mitglieder_count,
                (SELECT COUNT(*) FROM flow_arbeitspaket WHERE bildungsgang_id = bg.id) AS arbeitspakete_count
         FROM flow_bildungsgang bg
         ORDER BY bg.name`
    );
    return mapRows(result.rows);
}

export async function createBildungsgang(name, erlaubtMitgliedernPaketErstellung = false) {
    const result = await query(
        `INSERT INTO flow_bildungsgang (name, erlaubt_mitgliedern_paket_erstellung)
         VALUES ($1, $2)
         RETURNING *`,
        [name, erlaubtMitgliedernPaketErstellung]
    );
    return mapRow(result.rows[0]);
}

export async function getBildungsgangMitglieder(bildungsgangId) {
    const result = await query(
        `SELECT bgm.id, bgm.user_id,
                COALESCE(t.first_name, '') AS vorname,
                COALESCE(t.last_name, u.username) AS nachname,
                bgm.rolle, bgm.hinzugefuegt_am
         FROM flow_bildungsgang_mitglied bgm
         JOIN users u ON u.id = bgm.user_id
         LEFT JOIN teachers t ON t.id = u.teacher_id
         WHERE bgm.bildungsgang_id = $1 AND bgm.restricted IS NOT TRUE
         ORDER BY bgm.rolle DESC, t.last_name NULLS LAST`,
        [bildungsgangId]
    );
    return mapRows(result.rows);
}

export async function addBildungsgangMitglied(bildungsgangId, userId, rolle) {
    const result = await query(
        `INSERT INTO flow_bildungsgang_mitglied (bildungsgang_id, user_id, rolle)
         VALUES ($1, $2, $3)
         ON CONFLICT (bildungsgang_id, user_id) DO NOTHING
         RETURNING *`,
        [bildungsgangId, userId, rolle]
    );
    return mapRow(result.rows[0]) || null;
}

export async function updateBildungsgangMitgliedRolle(bildungsgangId, userId, rolle) {
    const result = await query(
        `UPDATE flow_bildungsgang_mitglied SET rolle = $1
         WHERE bildungsgang_id = $2 AND user_id = $3
         RETURNING *`,
        [rolle, bildungsgangId, userId]
    );
    return mapRow(result.rows[0]) || null;
}

export async function removeBildungsgangMitglied(bildungsgangId, userId) {
    const result = await query(
        `DELETE FROM flow_bildungsgang_mitglied
         WHERE bildungsgang_id = $1 AND user_id = $2
         RETURNING *`,
        [bildungsgangId, userId]
    );
    return mapRow(result.rows[0]) || null;
}
