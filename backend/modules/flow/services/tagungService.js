import { db } from '../../../db/database.js';
import { sql } from 'kysely';
import { camelToSnake, mapRow, mapRows, composeName, erstelleAktivitaet } from './flowHelpers.js';

// ── Tagungen ──

export async function getTagungen(paketId) {
    const rows = await db.selectFrom('flow_tagung as t')
        .selectAll('t')
        .select((eb) =>
            eb.selectFrom('flow_tagung_teilnehmer')
                .whereRef('flow_tagung_teilnehmer.tagung_id', '=', 't.id')
                .select(eb.fn.countAll().as('count'))
                .as('teilnehmende_count')
        )
        .where('t.arbeitspaket_id', '=', paketId)
        .orderBy('t.start_at', 'desc')
        .execute();
    return mapRows(rows);
}

export async function createTagung(paketId, data, erstelltVon) {
    const tagung = await db.insertInto('flow_tagung')
        .values({
            arbeitspaket_id: paketId,
            titel: data.titel,
            start_at: data.startAt,
            end_at: data.endAt || null,
            raum: data.raum || null
        })
        .returningAll()
        .executeTakeFirst();

    if (Array.isArray(data.teilnehmende) && data.teilnehmende.length > 0) {
        await db.insertInto('flow_tagung_teilnehmer')
            .values(data.teilnehmende.map(uid => ({ tagung_id: tagung.id, user_id: uid })))
            .onConflict((oc) => oc.doNothing())
            .execute();
    }

    await erstelleAktivitaet('tagung_erstellt', erstelltVon, paketId, {
        tagungId: tagung.id, titel: data.titel
    });

    return mapRow(tagung);
}

export async function getTagungDetail(tagungId) {
    const tagungRow = await db.selectFrom('flow_tagung')
        .selectAll()
        .where('id', '=', tagungId)
        .executeTakeFirst();
    if (!tagungRow) return null;

    const teilnehmerRows = await db.selectFrom('flow_tagung_teilnehmer as tt')
        .innerJoin('users as u', 'u.id', 'tt.user_id')
        .leftJoin('teachers as t', 't.id', 'u.teacher_id')
        .select([
            'tt.user_id',
            sql`COALESCE(t.first_name, '')`.as('vorname'),
            sql`COALESCE(t.last_name, u.username)`.as('nachname')
        ])
        .where('tt.tagung_id', '=', tagungId)
        .orderBy(sql`t.last_name NULLS LAST`)
        .execute();

    const agendaRows = await db.selectFrom('flow_agenda_punkt')
        .selectAll()
        .where('tagung_id', '=', tagungId)
        .orderBy('sortierung')
        .orderBy('created_at')
        .execute();

    return {
        ...mapRow(tagungRow),
        teilnehmende: mapRows(teilnehmerRows),
        agendaPunkte: mapRows(agendaRows)
    };
}

const ERLAUBTE_TAGUNG_FELDER = ['titel', 'start_at', 'end_at', 'raum'];

export async function updateTagung(tagungId, data) {
    const setObj = {};
    for (const [key, value] of Object.entries(data)) {
        const dbKey = camelToSnake(key);
        if (!ERLAUBTE_TAGUNG_FELDER.includes(dbKey)) continue;
        setObj[dbKey] = value;
    }

    if (Object.keys(setObj).length === 0) return null;

    const row = await db.updateTable('flow_tagung')
        .set(setObj)
        .where('id', '=', tagungId)
        .returningAll()
        .executeTakeFirst();
    return mapRow(row) || null;
}

export async function deleteTagung(tagungId) {
    await db.deleteFrom('flow_tagung').where('id', '=', tagungId).execute();
}

// ── Agenda ──

export async function addAgendaPunkt(tagungId, data) {
    const maxSortRow = await db.selectFrom('flow_agenda_punkt')
        .select(sql`COALESCE(MAX(sortierung), -1) + 1`.as('next'))
        .where('tagung_id', '=', tagungId)
        .executeTakeFirst();

    const row = await db.insertInto('flow_agenda_punkt')
        .values({
            tagung_id: tagungId,
            titel: data.titel,
            beschreibung: data.beschreibung || '',
            referenzierte_aufgabe_id: data.referenzierteAufgabeId || null,
            sortierung: maxSortRow.next
        })
        .returningAll()
        .executeTakeFirst();
    return mapRow(row);
}

export async function dokumentiereAgendaPunkt(punktId, data) {
    const setObj = {};

    if (data.ergebnis !== undefined) {
        setObj.ergebnis = data.ergebnis;
    }
    if (data.entscheidung !== undefined) {
        setObj.entscheidung = data.entscheidung;
    }

    if (Object.keys(setObj).length === 0) return null;

    const row = await db.updateTable('flow_agenda_punkt')
        .set(setObj)
        .where('id', '=', punktId)
        .returningAll()
        .executeTakeFirst();
    return mapRow(row) || null;
}

// ── Dateien ──

export async function getDateien(paketId) {
    const rows = await db.selectFrom('flow_datei as d')
        .leftJoin('users as u', 'u.id', 'd.hochgeladen_von')
        .leftJoin('teachers as t', 't.id', 'u.teacher_id')
        .selectAll('d')
        .select([
            sql`COALESCE(t.first_name, '')`.as('hochgeladen_von_vorname'),
            sql`COALESCE(t.last_name, u.username)`.as('hochgeladen_von_nachname')
        ])
        .where('d.arbeitspaket_id', '=', paketId)
        .orderBy('d.created_at', 'desc')
        .execute();
    return mapRows(rows).map(r => composeName(r, 'hochgeladenVon'));
}

export async function addDateiMetadaten(paketId, data, hochgeladenVon) {
    const row = await db.insertInto('flow_datei')
        .values({
            name: data.name,
            original_name: data.originalName,
            mime_type: data.mimeType,
            groesse: data.groesse,
            hochgeladen_von: hochgeladenVon,
            external_url: data.externalUrl || null,
            arbeitspaket_id: paketId
        })
        .returningAll()
        .executeTakeFirst();

    await erstelleAktivitaet('datei_hochgeladen', hochgeladenVon, paketId, {
        dateiId: row.id, name: data.originalName
    });

    return mapRow(row);
}

export async function deleteDatei(dateiId) {
    await db.deleteFrom('flow_datei').where('id', '=', dateiId).execute();
}
