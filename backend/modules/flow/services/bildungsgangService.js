import { db } from '../../../db/database.js';
import { sql } from 'kysely';
import { mapRow, mapRows } from './flowHelpers.js';

// ── Bildungsgang ──

export async function getBildungsgaengeForUser(userId) {
    const rows = await db.selectFrom('flow_bildungsgang as bg')
        .innerJoin('flow_bildungsgang_mitglied as bgm', 'bgm.bildungsgang_id', 'bg.id')
        .select([
            'bg.id', 'bg.name', 'bg.erlaubt_mitgliedern_paket_erstellung', 'bg.created_at',
            'bgm.rolle as meine_rolle',
            (eb) => eb.selectFrom('flow_arbeitspaket')
                .whereRef('flow_arbeitspaket.bildungsgang_id', '=', 'bg.id')
                .select(eb.fn.countAll().as('count'))
                .as('arbeitspakete_count')
        ])
        .where('bgm.user_id', '=', userId)
        .orderBy('bg.name')
        .execute();
    return mapRows(rows);
}

export async function getBildungsgangDetail(bildungsgangId) {
    const bgRow = await db.selectFrom('flow_bildungsgang')
        .selectAll()
        .where('id', '=', bildungsgangId)
        .executeTakeFirst();
    if (!bgRow) return null;

    const mitgliederRows = await db.selectFrom('flow_bildungsgang_mitglied as bgm')
        .innerJoin('users as u', 'u.id', 'bgm.user_id')
        .leftJoin('teachers as t', 't.id', 'u.teacher_id')
        .select([
            'bgm.id', 'bgm.user_id',
            sql`COALESCE(t.first_name, '')`.as('vorname'),
            sql`COALESCE(t.last_name, u.username)`.as('nachname'),
            'bgm.rolle', 'bgm.hinzugefuegt_am'
        ])
        .where('bgm.bildungsgang_id', '=', bildungsgangId)
        .where((eb) => eb.or([
            eb('bgm.restricted', 'is', null),
            eb('bgm.restricted', '=', false)
        ]))
        .orderBy('bgm.rolle', 'desc')
        .orderBy(sql`t.last_name NULLS LAST`)
        .execute();

    const paketeRows = await db.selectFrom('flow_arbeitspaket as ap')
        .select([
            'ap.id', 'ap.titel', 'ap.status', 'ap.deadline',
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
        .where('ap.bildungsgang_id', '=', bildungsgangId)
        .orderBy('ap.created_at', 'desc')
        .execute();

    return {
        ...mapRow(bgRow),
        mitglieder: mapRows(mitgliederRows),
        arbeitspakete: paketeRows.map(p => {
            const mapped = mapRow(p);
            return { ...mapped, fortschritt: { erledigt: parseInt(p.erledigt), gesamt: parseInt(p.gesamt) } };
        })
    };
}

// ── Bildungsgang Admin ──

export async function getAllBildungsgaenge() {
    const rows = await db.selectFrom('flow_bildungsgang as bg')
        .select([
            'bg.id', 'bg.name', 'bg.erlaubt_mitgliedern_paket_erstellung', 'bg.created_at',
            (eb) => eb.selectFrom('flow_bildungsgang_mitglied')
                .whereRef('flow_bildungsgang_mitglied.bildungsgang_id', '=', 'bg.id')
                .select(eb.fn.countAll().as('count'))
                .as('mitglieder_count'),
            (eb) => eb.selectFrom('flow_arbeitspaket')
                .whereRef('flow_arbeitspaket.bildungsgang_id', '=', 'bg.id')
                .select(eb.fn.countAll().as('count'))
                .as('arbeitspakete_count')
        ])
        .orderBy('bg.name')
        .execute();
    return mapRows(rows);
}

export async function createBildungsgang(name, erlaubtMitgliedernPaketErstellung = false) {
    const row = await db.insertInto('flow_bildungsgang')
        .values({ name, erlaubt_mitgliedern_paket_erstellung: erlaubtMitgliedernPaketErstellung })
        .returningAll()
        .executeTakeFirst();
    return mapRow(row);
}

export async function getBildungsgangMitglieder(bildungsgangId) {
    const rows = await db.selectFrom('flow_bildungsgang_mitglied as bgm')
        .innerJoin('users as u', 'u.id', 'bgm.user_id')
        .leftJoin('teachers as t', 't.id', 'u.teacher_id')
        .select([
            'bgm.id', 'bgm.user_id',
            sql`COALESCE(t.first_name, '')`.as('vorname'),
            sql`COALESCE(t.last_name, u.username)`.as('nachname'),
            'bgm.rolle', 'bgm.hinzugefuegt_am'
        ])
        .where('bgm.bildungsgang_id', '=', bildungsgangId)
        .where((eb) => eb.or([
            eb('bgm.restricted', 'is', null),
            eb('bgm.restricted', '=', false)
        ]))
        .orderBy('bgm.rolle', 'desc')
        .orderBy(sql`t.last_name NULLS LAST`)
        .execute();
    return mapRows(rows);
}

export async function addBildungsgangMitglied(bildungsgangId, userId, rolle) {
    const row = await db.insertInto('flow_bildungsgang_mitglied')
        .values({ bildungsgang_id: bildungsgangId, user_id: userId, rolle })
        .onConflict((oc) => oc.columns(['bildungsgang_id', 'user_id']).doNothing())
        .returningAll()
        .executeTakeFirst();
    return mapRow(row) || null;
}

export async function updateBildungsgangMitgliedRolle(bildungsgangId, userId, rolle) {
    const row = await db.updateTable('flow_bildungsgang_mitglied')
        .set({ rolle })
        .where('bildungsgang_id', '=', bildungsgangId)
        .where('user_id', '=', userId)
        .returningAll()
        .executeTakeFirst();
    return mapRow(row) || null;
}

export async function removeBildungsgangMitglied(bildungsgangId, userId) {
    const row = await db.deleteFrom('flow_bildungsgang_mitglied')
        .where('bildungsgang_id', '=', bildungsgangId)
        .where('user_id', '=', userId)
        .returningAll()
        .executeTakeFirst();
    return mapRow(row) || null;
}
