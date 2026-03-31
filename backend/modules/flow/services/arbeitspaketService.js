import { db } from '../../../db/database.js';
import { sql } from 'kysely';
import { camelToSnake, mapRow, mapRows, composeName, erstelleAktivitaet } from './flowHelpers.js';

// ── Arbeitspaket ──

export async function createArbeitspaket(bildungsgangId, data, erstelltVon) {
    const paket = await db.insertInto('flow_arbeitspaket')
        .values({
            bildungsgang_id: bildungsgangId,
            titel: data.titel,
            ist_zustand: data.istZustand,
            soll_zustand: data.sollZustand,
            beteiligte_beschreibung: data.beteiligteBeschreibung
        })
        .returningAll()
        .executeTakeFirst();

    // Ersteller automatisch als Koordination hinzufuegen
    await db.insertInto('flow_arbeitspaket_mitglied')
        .values({ arbeitspaket_id: paket.id, user_id: erstelltVon, rolle: 'koordination' })
        .execute();

    await erstelleAktivitaet('arbeitspaket_erstellt', erstelltVon, paket.id, { titel: data.titel });

    return mapRow(paket);
}

export async function getArbeitspaketDetail(paketId, userId) {
    const ap = await db.selectFrom('flow_arbeitspaket as ap')
        .innerJoin('flow_bildungsgang as bg', 'bg.id', 'ap.bildungsgang_id')
        .select([
            'ap.id', 'ap.bildungsgang_id', 'ap.titel', 'ap.ist_zustand', 'ap.soll_zustand',
            'ap.beteiligte_beschreibung', 'ap.status', 'ap.deadline', 'ap.geplante_tagungen',
            'ap.abgeschlossen_at', 'ap.abgeschlossen_von', 'ap.abschluss_zusammenfassung',
            'ap.reflexion', 'ap.created_at', 'ap.updated_at',
            'bg.name as bildungsgang_name'
        ])
        .where('ap.id', '=', paketId)
        .executeTakeFirst();
    if (!ap) return null;

    const mitgliederRows = await db.selectFrom('flow_arbeitspaket_mitglied as apm')
        .innerJoin('users as u', 'u.id', 'apm.user_id')
        .leftJoin('teachers as t', 't.id', 'u.teacher_id')
        .select([
            'apm.id', 'apm.user_id',
            sql`COALESCE(t.first_name, '')`.as('vorname'),
            sql`COALESCE(t.last_name, u.username)`.as('nachname'),
            'apm.rolle', 'apm.hinzugefuegt_am'
        ])
        .where('apm.arbeitspaket_id', '=', paketId)
        .where((eb) => eb.or([
            eb('apm.restricted', 'is', null),
            eb('apm.restricted', '=', false)
        ]))
        .orderBy('apm.rolle')
        .orderBy(sql`t.last_name NULLS LAST`)
        .execute();

    const meineRolleRow = await db.selectFrom('flow_arbeitspaket_mitglied')
        .select('rolle')
        .where('arbeitspaket_id', '=', paketId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

    const fortschrittRow = await db.selectFrom('flow_aufgabe')
        .select([
            sql`COUNT(*) FILTER (WHERE status = 'erledigt')`.as('erledigt'),
            sql`COUNT(*)`.as('gesamt')
        ])
        .where('arbeitspaket_id', '=', paketId)
        .executeTakeFirst();

    const tagungsRow = await db.selectFrom('flow_tagung')
        .select([
            sql`COUNT(*) FILTER (WHERE start_at < NOW())`.as('durchgefuehrt'),
            sql`COUNT(*) FILTER (WHERE start_at >= NOW())`.as('geplant')
        ])
        .where('arbeitspaket_id', '=', paketId)
        .executeTakeFirst();

    return {
        ...mapRow(ap),
        mitglieder: mapRows(mitgliederRows),
        meineRolle: meineRolleRow?.rolle || null,
        fortschritt: { erledigt: parseInt(fortschrittRow.erledigt), gesamt: parseInt(fortschrittRow.gesamt) },
        tagungsZaehler: { durchgefuehrt: parseInt(tagungsRow.durchgefuehrt), geplant: parseInt(tagungsRow.geplant) }
    };
}

const ERLAUBTE_AP_FELDER = ['titel', 'ist_zustand', 'soll_zustand', 'beteiligte_beschreibung', 'deadline', 'geplante_tagungen'];

export async function updateArbeitspaket(paketId, data, expectedUpdatedAt) {
    const setObj = {};
    for (const [key, value] of Object.entries(data)) {
        const dbKey = camelToSnake(key);
        if (!ERLAUBTE_AP_FELDER.includes(dbKey)) continue;
        setObj[dbKey] = value;
    }

    if (Object.keys(setObj).length === 0) return null;

    setObj.updated_at = sql`NOW()`;

    const row = await db.updateTable('flow_arbeitspaket')
        .set(setObj)
        .where('id', '=', paketId)
        .where('updated_at', '=', expectedUpdatedAt)
        .returningAll()
        .executeTakeFirst();

    return mapRow(row) || null;
}

const ERLAUBTE_UEBERGAENGE = {
    entwurf: ['geplant'],
    geplant: ['aktiv', 'entwurf'],
    aktiv: ['abgeschlossen'],
    abgeschlossen: ['aktiv']
};

export async function updateArbeitspaketStatus(paketId, zielStatus, userId) {
    const current = await db.selectFrom('flow_arbeitspaket')
        .select('status')
        .where('id', '=', paketId)
        .executeTakeFirst();
    if (!current) return { error: 'Nicht gefunden' };

    const aktuellerStatus = current.status;
    const erlaubt = ERLAUBTE_UEBERGAENGE[aktuellerStatus] || [];

    if (!erlaubt.includes(zielStatus)) {
        return {
            error: 'Unerlaubter Statusuebergang',
            erlaubt,
            aktuell: aktuellerStatus,
            ziel: zielStatus
        };
    }

    const row = await db.updateTable('flow_arbeitspaket')
        .set({ status: zielStatus, updated_at: sql`NOW()` })
        .where('id', '=', paketId)
        .returningAll()
        .executeTakeFirst();

    await erstelleAktivitaet('arbeitspaket_status_geaendert', userId, paketId, {
        von: aktuellerStatus, nach: zielStatus
    });

    return { paket: mapRow(row) };
}

export async function deleteArbeitspaket(paketId) {
    const check = await db.selectFrom('flow_arbeitspaket')
        .select('status')
        .where('id', '=', paketId)
        .executeTakeFirst();
    if (!check) return { error: 'Nicht gefunden' };
    if (check.status !== 'entwurf') {
        return { error: 'Nur Arbeitspakete im Status Entwurf koennen geloescht werden' };
    }
    await db.deleteFrom('flow_arbeitspaket').where('id', '=', paketId).execute();
    return { ok: true };
}

export async function abschliessenArbeitspaket(paketId, data, userId) {
    const row = await db.updateTable('flow_arbeitspaket')
        .set({
            status: 'abgeschlossen',
            abgeschlossen_at: sql`NOW()`,
            abgeschlossen_von: userId,
            abschluss_zusammenfassung: data.abschlussZusammenfassung,
            reflexion: data.reflexion || null,
            updated_at: sql`NOW()`
        })
        .where('id', '=', paketId)
        .where('status', '=', 'aktiv')
        .returningAll()
        .executeTakeFirst();
    if (!row) return null;

    await erstelleAktivitaet('arbeitspaket_abgeschlossen', userId, paketId, {});
    return mapRow(row);
}

export async function wiederaufnehmenArbeitspaket(paketId, userId) {
    const row = await db.updateTable('flow_arbeitspaket')
        .set({
            status: 'aktiv',
            abgeschlossen_at: null,
            abgeschlossen_von: null,
            abschluss_zusammenfassung: null,
            reflexion: null,
            updated_at: sql`NOW()`
        })
        .where('id', '=', paketId)
        .where('status', '=', 'abgeschlossen')
        .returningAll()
        .executeTakeFirst();
    if (!row) return null;

    await erstelleAktivitaet('arbeitspaket_wiederaufgenommen', userId, paketId, {});
    return mapRow(row);
}

// ── Mitglieder ──

export async function getMitglieder(paketId) {
    const rows = await db.selectFrom('flow_arbeitspaket_mitglied as apm')
        .innerJoin('users as u', 'u.id', 'apm.user_id')
        .leftJoin('teachers as t', 't.id', 'u.teacher_id')
        .select([
            'apm.id', 'apm.user_id',
            sql`COALESCE(t.first_name, '')`.as('vorname'),
            sql`COALESCE(t.last_name, u.username)`.as('nachname'),
            'apm.rolle', 'apm.hinzugefuegt_am'
        ])
        .where('apm.arbeitspaket_id', '=', paketId)
        .where((eb) => eb.or([
            eb('apm.restricted', 'is', null),
            eb('apm.restricted', '=', false)
        ]))
        .orderBy('apm.rolle')
        .orderBy(sql`t.last_name NULLS LAST`)
        .execute();
    return mapRows(rows);
}

export async function addMitglied(paketId, userId, rolle, akteur) {
    const row = await db.insertInto('flow_arbeitspaket_mitglied')
        .values({ arbeitspaket_id: paketId, user_id: userId, rolle })
        .onConflict((oc) => oc.columns(['arbeitspaket_id', 'user_id']).doNothing())
        .returningAll()
        .executeTakeFirst();
    if (row) {
        await erstelleAktivitaet('mitglied_hinzugefuegt', akteur, paketId, { userId, rolle });
    }
    return mapRow(row) || null;
}

export async function updateMitgliedRolle(paketId, userId, rolle, akteur) {
    const row = await db.updateTable('flow_arbeitspaket_mitglied')
        .set({ rolle })
        .where('arbeitspaket_id', '=', paketId)
        .where('user_id', '=', userId)
        .returningAll()
        .executeTakeFirst();
    if (row) {
        await erstelleAktivitaet('rolle_geaendert', akteur, paketId, { userId, rolle });
    }
    return mapRow(row) || null;
}

export async function removeMitglied(paketId, userId, akteur) {
    const row = await db.deleteFrom('flow_arbeitspaket_mitglied')
        .where('arbeitspaket_id', '=', paketId)
        .where('user_id', '=', userId)
        .returningAll()
        .executeTakeFirst();
    if (row) {
        await erstelleAktivitaet('mitglied_entfernt', akteur, paketId, { userId });
    }
    return mapRow(row) || null;
}

// ── Dashboard ──

export async function getDashboardDaten(userId) {
    const statistikRow = await db.selectFrom('flow_aufgabe')
        .select([
            sql`COUNT(*) FILTER (WHERE status = 'offen')`.as('offen'),
            sql`COUNT(*) FILTER (WHERE deadline < NOW() AND status != 'erledigt')`.as('ueberfaellig'),
            sql`COUNT(*) FILTER (WHERE status = 'erledigt' AND erledigt_at >= date_trunc('month', NOW()))`.as('erledigt_diesen_monat')
        ])
        .where('zustaendig', '=', userId)
        .executeTakeFirst();

    const aufgabenRows = await db.selectFrom('flow_aufgabe as a')
        .innerJoin('flow_arbeitspaket as ap', 'ap.id', 'a.arbeitspaket_id')
        .selectAll('a')
        .select('ap.titel as arbeitspaket_titel')
        .where('a.zustaendig', '=', userId)
        .where('a.status', '!=', 'erledigt')
        .orderBy(sql`a.deadline NULLS LAST`)
        .orderBy('a.created_at')
        .limit(10)
        .execute();

    const paketeRows = await db.selectFrom('flow_arbeitspaket as ap')
        .innerJoin('flow_arbeitspaket_mitglied as apm', 'apm.arbeitspaket_id', 'ap.id')
        .innerJoin('flow_bildungsgang as bg', 'bg.id', 'ap.bildungsgang_id')
        .select([
            'ap.id', 'ap.titel', 'bg.name as bildungsgang_name', 'ap.status', 'ap.deadline',
            'apm.rolle as meine_rolle',
            (eb) => eb.selectFrom('flow_aufgabe')
                .whereRef('flow_aufgabe.arbeitspaket_id', '=', 'ap.id')
                .where('flow_aufgabe.status', '=', 'erledigt')
                .select(eb.fn.countAll().as('count'))
                .as('erledigt'),
            (eb) => eb.selectFrom('flow_aufgabe')
                .whereRef('flow_aufgabe.arbeitspaket_id', '=', 'ap.id')
                .select(eb.fn.countAll().as('count'))
                .as('gesamt')
        ])
        .where('apm.user_id', '=', userId)
        .where('ap.status', 'in', ['aktiv', 'geplant'])
        .orderBy(sql`ap.deadline NULLS LAST`)
        .execute();

    const tagungenRows = await db.selectFrom('flow_tagung as t')
        .innerJoin('flow_arbeitspaket as ap', 'ap.id', 't.arbeitspaket_id')
        .innerJoin('flow_tagung_teilnehmer as tt', 'tt.tagung_id', 't.id')
        .select([
            't.id', 't.titel', 't.start_at', 't.raum', 'ap.titel as arbeitspaket_titel',
            (eb) => eb.selectFrom('flow_tagung_teilnehmer')
                .whereRef('flow_tagung_teilnehmer.tagung_id', '=', 't.id')
                .select(eb.fn.countAll().as('count'))
                .as('teilnehmende_count')
        ])
        .where('tt.user_id', '=', userId)
        .where('t.start_at', '>=', sql`NOW()`)
        .orderBy('t.start_at')
        .limit(5)
        .execute();

    return {
        statistik: {
            offen: parseInt(statistikRow.offen),
            ueberfaellig: parseInt(statistikRow.ueberfaellig),
            erledigtDiesenMonat: parseInt(statistikRow.erledigt_diesen_monat)
        },
        meineAufgaben: mapRows(aufgabenRows),
        aktiveArbeitspakete: paketeRows.map(p => {
            const mapped = mapRow(p);
            return { ...mapped, fortschritt: { erledigt: parseInt(p.erledigt), gesamt: parseInt(p.gesamt) } };
        }),
        naechsteTagungen: mapRows(tagungenRows)
    };
}

// ── Abteilung ──

export async function getAbteilungsUebersicht() {
    const rows = await db.selectFrom('flow_arbeitspaket as ap')
        .innerJoin('flow_bildungsgang as bg', 'bg.id', 'ap.bildungsgang_id')
        .select(['ap.id', 'ap.titel', 'ap.status', 'ap.deadline', 'bg.name as bildungsgang'])
        .orderBy('bg.name')
        .orderBy('ap.status')
        .orderBy(sql`ap.deadline NULLS LAST`)
        .execute();
    return mapRows(rows);
}

// ── Aktivitaeten ──

export async function getAktivitaeten(paketId, limit = 20) {
    const rows = await db.selectFrom('flow_aktivitaet as a')
        .leftJoin('users as u', 'u.id', 'a.akteur')
        .leftJoin('teachers as t', 't.id', 'u.teacher_id')
        .selectAll('a')
        .select([
            sql`COALESCE(t.first_name, '')`.as('akteur_vorname'),
            sql`COALESCE(t.last_name, u.username)`.as('akteur_nachname')
        ])
        .where('a.arbeitspaket_id', '=', paketId)
        .where((eb) => eb.or([
            eb('a.restricted', 'is', null),
            eb('a.restricted', '=', false)
        ]))
        .orderBy('a.created_at', 'desc')
        .limit(limit)
        .execute();
    return mapRows(rows).map(r => composeName(r, 'akteur'));
}
