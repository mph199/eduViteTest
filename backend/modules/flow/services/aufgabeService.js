import { db } from '../../../db/database.js';
import { sql } from 'kysely';
import { camelToSnake, mapRow, mapRows, composeName, erstelleAktivitaet } from './flowHelpers.js';

// ── Aufgaben ──

export async function getAufgaben(paketId) {
    const rows = await db.selectFrom('flow_aufgabe as a')
        .leftJoin('users as u', 'u.id', 'a.zustaendig')
        .leftJoin('teachers as t', 't.id', 'u.teacher_id')
        .selectAll('a')
        .select([
            sql`COALESCE(t.first_name, '')`.as('zustaendig_vorname'),
            sql`COALESCE(t.last_name, u.username)`.as('zustaendig_nachname')
        ])
        .where('a.arbeitspaket_id', '=', paketId)
        .where((eb) => eb.or([
            eb('a.restricted', 'is', null),
            eb('a.restricted', '=', false)
        ]))
        .orderBy('a.status')
        .orderBy(sql`a.deadline NULLS LAST`)
        .orderBy('a.created_at')
        .execute();
    return mapRows(rows).map(r => composeName(r, 'zustaendig'));
}

export async function createAufgabe(paketId, data, erstelltVon) {
    const row = await db.insertInto('flow_aufgabe')
        .values({
            arbeitspaket_id: paketId,
            titel: data.titel,
            beschreibung: data.beschreibung || '',
            zustaendig: data.zustaendig,
            erstellt_von: erstelltVon,
            deadline: data.deadline || null,
            erstellt_aus: data.tagungId ? 'tagung' : 'planung',
            tagung_id: data.tagungId || null
        })
        .returningAll()
        .executeTakeFirst();

    await erstelleAktivitaet('aufgabe_erstellt', erstelltVon, paketId, {
        aufgabeId: row.id, titel: data.titel
    });

    return mapRow(row);
}

const ERLAUBTE_AUFGABE_FELDER = ['titel', 'beschreibung', 'zustaendig', 'deadline'];

export async function updateAufgabe(aufgabeId, data) {
    const setObj = {};
    for (const [key, value] of Object.entries(data)) {
        const dbKey = camelToSnake(key);
        if (!ERLAUBTE_AUFGABE_FELDER.includes(dbKey)) continue;
        setObj[dbKey] = value;
    }

    if (Object.keys(setObj).length === 0) return null;

    setObj.updated_at = sql`NOW()`;

    const row = await db.updateTable('flow_aufgabe')
        .set(setObj)
        .where('id', '=', aufgabeId)
        .returningAll()
        .executeTakeFirst();
    return mapRow(row) || null;
}

export async function updateAufgabeStatus(aufgabeId, status, userId) {
    const row = await db.updateTable('flow_aufgabe')
        .set({
            status,
            erledigt_at: sql`CASE WHEN ${status} = 'erledigt' THEN NOW() ELSE NULL END`,
            updated_at: sql`NOW()`
        })
        .where('id', '=', aufgabeId)
        .returningAll()
        .executeTakeFirst();
    if (!row) return null;

    await erstelleAktivitaet('aufgabe_status_geaendert', userId, row.arbeitspaket_id, {
        aufgabeId, status
    });
    return mapRow(row);
}

export async function deleteAufgabe(aufgabeId, userId) {
    const aufgabe = await db.selectFrom('flow_aufgabe')
        .selectAll()
        .where('id', '=', aufgabeId)
        .executeTakeFirst();
    if (!aufgabe) return null;

    await db.deleteFrom('flow_aufgabe').where('id', '=', aufgabeId).execute();
    await erstelleAktivitaet('aufgabe_geloescht', userId, aufgabe.arbeitspaket_id, {
        aufgabeId, titel: aufgabe.titel
    });
    return mapRow(aufgabe);
}

export async function getMeineAufgaben(userId, filter = {}) {
    let query = db.selectFrom('flow_aufgabe as a')
        .innerJoin('flow_arbeitspaket as ap', 'ap.id', 'a.arbeitspaket_id')
        .leftJoin('users as u', 'u.id', 'a.zustaendig')
        .leftJoin('teachers as t', 't.id', 'u.teacher_id')
        .selectAll('a')
        .select([
            'ap.titel as arbeitspaket_titel',
            sql`COALESCE(t.first_name, '')`.as('zustaendig_vorname'),
            sql`COALESCE(t.last_name, u.username)`.as('zustaendig_nachname')
        ])
        .where('a.zustaendig', '=', userId)
        .where((eb) => eb.or([
            eb('a.restricted', 'is', null),
            eb('a.restricted', '=', false)
        ]));

    if (filter.status) {
        query = query.where('a.status', '=', filter.status);
    }
    if (filter.ueberfaellig) {
        query = query.where('a.deadline', '<', sql`NOW()`)
            .where('a.status', '!=', 'erledigt');
    }

    const rows = await query
        .orderBy(sql`a.deadline NULLS LAST`)
        .orderBy('a.created_at')
        .execute();
    return mapRows(rows).map(r => composeName(r, 'zustaendig'));
}
