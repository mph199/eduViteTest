import { query } from '../../../config/db.js';
import { camelToSnake, mapRow, mapRows, composeName, erstelleAktivitaet } from './flowHelpers.js';

// ── Tagungen ──

export async function getTagungen(paketId) {
    const result = await query(
        `SELECT t.*, (SELECT COUNT(*) FROM flow_tagung_teilnehmer WHERE tagung_id = t.id) AS teilnehmende_count
         FROM flow_tagung t
         WHERE t.arbeitspaket_id = $1
         ORDER BY t.start_at DESC`,
        [paketId]
    );
    return mapRows(result.rows);
}

export async function createTagung(paketId, data, erstelltVon) {
    const result = await query(
        `INSERT INTO flow_tagung (arbeitspaket_id, titel, start_at, end_at, raum)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [paketId, data.titel, data.startAt, data.endAt || null, data.raum || null]
    );
    const tagung = result.rows[0];

    if (Array.isArray(data.teilnehmende) && data.teilnehmende.length > 0) {
        const valuesParts = data.teilnehmende.map((uid, i) => `($1, $${i + 2})`);
        await query(
            `INSERT INTO flow_tagung_teilnehmer (tagung_id, user_id)
             VALUES ${valuesParts.join(', ')}
             ON CONFLICT DO NOTHING`,
            [tagung.id, ...data.teilnehmende]
        );
    }

    await erstelleAktivitaet('tagung_erstellt', erstelltVon, paketId, {
        tagungId: tagung.id, titel: data.titel
    });

    return mapRow(tagung);
}

export async function getTagungDetail(tagungId) {
    const tagungResult = await query('SELECT * FROM flow_tagung WHERE id = $1', [tagungId]);
    if (tagungResult.rows.length === 0) return null;

    const teilnehmerResult = await query(
        `SELECT tt.user_id,
                COALESCE(t.first_name, '') AS vorname,
                COALESCE(t.last_name, u.username) AS nachname
         FROM flow_tagung_teilnehmer tt
         JOIN users u ON u.id = tt.user_id
         LEFT JOIN teachers t ON t.id = u.teacher_id
         WHERE tt.tagung_id = $1
         ORDER BY t.last_name NULLS LAST`,
        [tagungId]
    );

    const agendaResult = await query(
        `SELECT * FROM flow_agenda_punkt
         WHERE tagung_id = $1
         ORDER BY sortierung, created_at`,
        [tagungId]
    );

    return {
        ...mapRow(tagungResult.rows[0]),
        teilnehmende: mapRows(teilnehmerResult.rows),
        agendaPunkte: mapRows(agendaResult.rows)
    };
}

const ERLAUBTE_TAGUNG_FELDER = ['titel', 'start_at', 'end_at', 'raum'];

export async function updateTagung(tagungId, data) {
    const sets = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
        const dbKey = camelToSnake(key);
        if (!ERLAUBTE_TAGUNG_FELDER.includes(dbKey)) continue;
        sets.push(`${dbKey} = $${idx}`);
        values.push(value);
        idx++;
    }

    if (sets.length === 0) return null;

    values.push(tagungId);

    const result = await query(
        `UPDATE flow_tagung SET ${sets.join(', ')}
         WHERE id = $${idx}
         RETURNING *`,
        values
    );
    return mapRow(result.rows[0]) || null;
}

export async function deleteTagung(tagungId) {
    await query('DELETE FROM flow_tagung WHERE id = $1', [tagungId]);
}

// ── Agenda ──

export async function addAgendaPunkt(tagungId, data) {
    const maxSort = await query(
        'SELECT COALESCE(MAX(sortierung), -1) + 1 AS next FROM flow_agenda_punkt WHERE tagung_id = $1',
        [tagungId]
    );

    const result = await query(
        `INSERT INTO flow_agenda_punkt (tagung_id, titel, beschreibung, referenzierte_aufgabe_id, sortierung)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [tagungId, data.titel, data.beschreibung || '', data.referenzierteAufgabeId || null, maxSort.rows[0].next]
    );
    return mapRow(result.rows[0]);
}

export async function dokumentiereAgendaPunkt(punktId, data) {
    const sets = [];
    const values = [];
    let idx = 1;

    if (data.ergebnis !== undefined) {
        sets.push(`ergebnis = $${idx}`);
        values.push(data.ergebnis);
        idx++;
    }
    if (data.entscheidung !== undefined) {
        sets.push(`entscheidung = $${idx}`);
        values.push(data.entscheidung);
        idx++;
    }

    if (sets.length === 0) return null;

    values.push(punktId);

    const result = await query(
        `UPDATE flow_agenda_punkt SET ${sets.join(', ')}
         WHERE id = $${idx}
         RETURNING *`,
        values
    );
    return mapRow(result.rows[0]) || null;
}

// ── Dateien ──

export async function getDateien(paketId) {
    const result = await query(
        `SELECT d.*,
                COALESCE(t.first_name, '') AS hochgeladen_von_vorname,
                COALESCE(t.last_name, u.username) AS hochgeladen_von_nachname
         FROM flow_datei d
         LEFT JOIN users u ON u.id = d.hochgeladen_von
         LEFT JOIN teachers t ON t.id = u.teacher_id
         WHERE d.arbeitspaket_id = $1
         ORDER BY d.created_at DESC`,
        [paketId]
    );
    return mapRows(result.rows).map(r => composeName(r, 'hochgeladenVon'));
}

export async function addDateiMetadaten(paketId, data, hochgeladenVon) {
    const result = await query(
        `INSERT INTO flow_datei (name, original_name, mime_type, groesse, hochgeladen_von, external_url, arbeitspaket_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [data.name, data.originalName, data.mimeType, data.groesse, hochgeladenVon, data.externalUrl || null, paketId]
    );

    await erstelleAktivitaet('datei_hochgeladen', hochgeladenVon, paketId, {
        dateiId: result.rows[0].id, name: data.originalName
    });

    return mapRow(result.rows[0]);
}

export async function deleteDatei(dateiId) {
    await query('DELETE FROM flow_datei WHERE id = $1', [dateiId]);
}
