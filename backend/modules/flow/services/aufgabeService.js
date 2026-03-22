import { query } from '../../../config/db.js';
import { camelToSnake, mapRow, mapRows, composeName, erstelleAktivitaet } from './flowHelpers.js';

// ── Aufgaben ──

export async function getAufgaben(paketId) {
    const result = await query(
        `SELECT a.*,
                COALESCE(t.first_name, '') AS zustaendig_vorname,
                COALESCE(t.last_name, u.username) AS zustaendig_nachname
         FROM flow_aufgabe a
         LEFT JOIN users u ON u.id = a.zustaendig
         LEFT JOIN teachers t ON t.id = u.teacher_id
         WHERE a.arbeitspaket_id = $1 AND a.restricted IS NOT TRUE
         ORDER BY a.status, a.deadline NULLS LAST, a.created_at`,
        [paketId]
    );
    return mapRows(result.rows).map(r => composeName(r, 'zustaendig'));
}

export async function createAufgabe(paketId, data, erstelltVon) {
    const result = await query(
        `INSERT INTO flow_aufgabe (arbeitspaket_id, titel, beschreibung, zustaendig, erstellt_von, deadline, erstellt_aus, tagung_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
            paketId, data.titel, data.beschreibung || '',
            data.zustaendig, erstelltVon, data.deadline || null,
            data.tagungId ? 'tagung' : 'planung', data.tagungId || null
        ]
    );

    await erstelleAktivitaet('aufgabe_erstellt', erstelltVon, paketId, {
        aufgabeId: result.rows[0].id, titel: data.titel
    });

    return mapRow(result.rows[0]);
}

const ERLAUBTE_AUFGABE_FELDER = ['titel', 'beschreibung', 'zustaendig', 'deadline'];

export async function updateAufgabe(aufgabeId, data) {
    const sets = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
        const dbKey = camelToSnake(key);
        if (!ERLAUBTE_AUFGABE_FELDER.includes(dbKey)) continue;
        sets.push(`${dbKey} = $${idx}`);
        values.push(value);
        idx++;
    }

    if (sets.length === 0) return null;

    sets.push(`updated_at = NOW()`);
    values.push(aufgabeId);

    const result = await query(
        `UPDATE flow_aufgabe SET ${sets.join(', ')}
         WHERE id = $${idx}
         RETURNING *`,
        values
    );
    return mapRow(result.rows[0]) || null;
}

export async function updateAufgabeStatus(aufgabeId, status, userId) {
    const result = await query(
        `UPDATE flow_aufgabe SET status = $1,
         erledigt_at = CASE WHEN $1 = 'erledigt' THEN NOW() ELSE NULL END,
         updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, aufgabeId]
    );
    if (result.rows.length === 0) return null;

    const aufgabe = result.rows[0];
    await erstelleAktivitaet('aufgabe_status_geaendert', userId, aufgabe.arbeitspaket_id, {
        aufgabeId, status
    });
    return mapRow(aufgabe);
}

export async function deleteAufgabe(aufgabeId, userId) {
    const aufgabe = await query('SELECT * FROM flow_aufgabe WHERE id = $1', [aufgabeId]);
    if (aufgabe.rows.length === 0) return null;

    await query('DELETE FROM flow_aufgabe WHERE id = $1', [aufgabeId]);
    await erstelleAktivitaet('aufgabe_geloescht', userId, aufgabe.rows[0].arbeitspaket_id, {
        aufgabeId, titel: aufgabe.rows[0].titel
    });
    return mapRow(aufgabe.rows[0]);
}

export async function getMeineAufgaben(userId, filter = {}) {
    let where = 'a.zustaendig = $1 AND a.restricted IS NOT TRUE';
    const values = [userId];
    let idx = 2;

    if (filter.status) {
        where += ` AND a.status = $${idx}`;
        values.push(filter.status);
        idx++;
    }
    if (filter.ueberfaellig) {
        where += ` AND a.deadline < NOW() AND a.status != 'erledigt'`;
    }

    const result = await query(
        `SELECT a.*, ap.titel AS arbeitspaket_titel,
                COALESCE(t.first_name, '') AS zustaendig_vorname,
                COALESCE(t.last_name, u.username) AS zustaendig_nachname
         FROM flow_aufgabe a
         JOIN flow_arbeitspaket ap ON ap.id = a.arbeitspaket_id
         LEFT JOIN users u ON u.id = a.zustaendig
         LEFT JOIN teachers t ON t.id = u.teacher_id
         WHERE ${where}
         ORDER BY a.deadline NULLS LAST, a.created_at`,
        values
    );
    return mapRows(result.rows).map(r => composeName(r, 'zustaendig'));
}
