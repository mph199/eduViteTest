import { query } from '../../../config/db.js';
import { camelToSnake, mapRow, mapRows, composeName, erstelleAktivitaet } from './flowHelpers.js';

// ── Arbeitspaket ──

export async function createArbeitspaket(bildungsgangId, data, erstelltVon) {
    const result = await query(
        `INSERT INTO flow_arbeitspaket (bildungsgang_id, titel, ist_zustand, soll_zustand, beteiligte_beschreibung)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [bildungsgangId, data.titel, data.istZustand, data.sollZustand, data.beteiligteBeschreibung]
    );
    const paket = result.rows[0];

    // Ersteller automatisch als Koordination hinzufuegen
    await query(
        `INSERT INTO flow_arbeitspaket_mitglied (arbeitspaket_id, user_id, rolle)
         VALUES ($1, $2, 'koordination')`,
        [paket.id, erstelltVon]
    );

    await erstelleAktivitaet('arbeitspaket_erstellt', erstelltVon, paket.id, { titel: data.titel });

    return mapRow(paket);
}

export async function getArbeitspaketDetail(paketId, userId) {
    const apResult = await query(
        `SELECT ap.*, bg.name AS bildungsgang_name
         FROM flow_arbeitspaket ap
         JOIN flow_bildungsgang bg ON bg.id = ap.bildungsgang_id
         WHERE ap.id = $1`,
        [paketId]
    );
    if (apResult.rows.length === 0) return null;

    const mitgliederResult = await query(
        `SELECT apm.id, apm.user_id,
                COALESCE(t.first_name, '') AS vorname,
                COALESCE(t.last_name, u.username) AS nachname,
                apm.rolle, apm.hinzugefuegt_am
         FROM flow_arbeitspaket_mitglied apm
         JOIN users u ON u.id = apm.user_id
         LEFT JOIN teachers t ON t.id = u.teacher_id
         WHERE apm.arbeitspaket_id = $1 AND apm.restricted IS NOT TRUE
         ORDER BY apm.rolle, t.last_name NULLS LAST`,
        [paketId]
    );

    const meineRolleResult = await query(
        'SELECT rolle FROM flow_arbeitspaket_mitglied WHERE arbeitspaket_id = $1 AND user_id = $2',
        [paketId, userId]
    );

    const fortschrittResult = await query(
        `SELECT
            COUNT(*) FILTER (WHERE status = 'erledigt') AS erledigt,
            COUNT(*) AS gesamt
         FROM flow_aufgabe WHERE arbeitspaket_id = $1`,
        [paketId]
    );

    const tagungsResult = await query(
        `SELECT
            COUNT(*) FILTER (WHERE start_at < NOW()) AS durchgefuehrt,
            COUNT(*) FILTER (WHERE start_at >= NOW()) AS geplant
         FROM flow_tagung WHERE arbeitspaket_id = $1`,
        [paketId]
    );

    const ap = apResult.rows[0];
    const fortschritt = fortschrittResult.rows[0];
    const tagungen = tagungsResult.rows[0];

    return {
        ...mapRow(ap),
        mitglieder: mapRows(mitgliederResult.rows),
        meineRolle: meineRolleResult.rows[0]?.rolle || null,
        fortschritt: { erledigt: parseInt(fortschritt.erledigt), gesamt: parseInt(fortschritt.gesamt) },
        tagungsZaehler: { durchgefuehrt: parseInt(tagungen.durchgefuehrt), geplant: parseInt(tagungen.geplant) }
    };
}

const ERLAUBTE_AP_FELDER = ['titel', 'ist_zustand', 'soll_zustand', 'beteiligte_beschreibung', 'deadline', 'geplante_tagungen'];

export async function updateArbeitspaket(paketId, data, expectedUpdatedAt) {
    const sets = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
        const dbKey = camelToSnake(key);
        if (!ERLAUBTE_AP_FELDER.includes(dbKey)) continue;
        sets.push(`${dbKey} = $${idx}`);
        values.push(value);
        idx++;
    }

    if (sets.length === 0) return null;

    sets.push(`updated_at = NOW()`);
    values.push(paketId, expectedUpdatedAt);

    const result = await query(
        `UPDATE flow_arbeitspaket SET ${sets.join(', ')}
         WHERE id = $${idx} AND updated_at = $${idx + 1}
         RETURNING *`,
        values
    );

    return mapRow(result.rows[0]) || null;
}

const ERLAUBTE_UEBERGAENGE = {
    entwurf: ['geplant'],
    geplant: ['aktiv', 'entwurf'],
    aktiv: ['abgeschlossen'],
    abgeschlossen: ['aktiv']
};

export async function updateArbeitspaketStatus(paketId, zielStatus, userId) {
    const current = await query('SELECT status FROM flow_arbeitspaket WHERE id = $1', [paketId]);
    if (current.rows.length === 0) return { error: 'Nicht gefunden' };

    const aktuellerStatus = current.rows[0].status;
    const erlaubt = ERLAUBTE_UEBERGAENGE[aktuellerStatus] || [];

    if (!erlaubt.includes(zielStatus)) {
        return {
            error: 'Unerlaubter Statusuebergang',
            erlaubt,
            aktuell: aktuellerStatus,
            ziel: zielStatus
        };
    }

    const result = await query(
        `UPDATE flow_arbeitspaket SET status = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [zielStatus, paketId]
    );

    await erstelleAktivitaet('arbeitspaket_status_geaendert', userId, paketId, {
        von: aktuellerStatus, nach: zielStatus
    });

    return { paket: mapRow(result.rows[0]) };
}

export async function deleteArbeitspaket(paketId) {
    const check = await query('SELECT status FROM flow_arbeitspaket WHERE id = $1', [paketId]);
    if (check.rows.length === 0) return { error: 'Nicht gefunden' };
    if (check.rows[0].status !== 'entwurf') {
        return { error: 'Nur Arbeitspakete im Status Entwurf koennen geloescht werden' };
    }
    await query('DELETE FROM flow_arbeitspaket WHERE id = $1', [paketId]);
    return { ok: true };
}

export async function abschliessenArbeitspaket(paketId, data, userId) {
    const result = await query(
        `UPDATE flow_arbeitspaket
         SET status = 'abgeschlossen', abgeschlossen_at = NOW(), abgeschlossen_von = $1,
             abschluss_zusammenfassung = $2, reflexion = $3, updated_at = NOW()
         WHERE id = $4 AND status = 'aktiv'
         RETURNING *`,
        [userId, data.abschlussZusammenfassung, data.reflexion || null, paketId]
    );
    if (result.rows.length === 0) return null;

    await erstelleAktivitaet('arbeitspaket_abgeschlossen', userId, paketId, {});
    return mapRow(result.rows[0]);
}

export async function wiederaufnehmenArbeitspaket(paketId, userId) {
    const result = await query(
        `UPDATE flow_arbeitspaket
         SET status = 'aktiv', abgeschlossen_at = NULL, abgeschlossen_von = NULL,
             abschluss_zusammenfassung = NULL, reflexion = NULL, updated_at = NOW()
         WHERE id = $1 AND status = 'abgeschlossen'
         RETURNING *`,
        [paketId]
    );
    if (result.rows.length === 0) return null;

    await erstelleAktivitaet('arbeitspaket_wiederaufgenommen', userId, paketId, {});
    return mapRow(result.rows[0]);
}

// ── Mitglieder ──

export async function getMitglieder(paketId) {
    const result = await query(
        `SELECT apm.id, apm.user_id,
                COALESCE(t.first_name, '') AS vorname,
                COALESCE(t.last_name, u.username) AS nachname,
                apm.rolle, apm.hinzugefuegt_am
         FROM flow_arbeitspaket_mitglied apm
         JOIN users u ON u.id = apm.user_id
         LEFT JOIN teachers t ON t.id = u.teacher_id
         WHERE apm.arbeitspaket_id = $1 AND apm.restricted IS NOT TRUE
         ORDER BY apm.rolle, t.last_name NULLS LAST`,
        [paketId]
    );
    return mapRows(result.rows);
}

export async function addMitglied(paketId, userId, rolle, akteur) {
    const result = await query(
        `INSERT INTO flow_arbeitspaket_mitglied (arbeitspaket_id, user_id, rolle)
         VALUES ($1, $2, $3)
         ON CONFLICT (arbeitspaket_id, user_id) DO NOTHING
         RETURNING *`,
        [paketId, userId, rolle]
    );
    if (result.rows.length > 0) {
        await erstelleAktivitaet('mitglied_hinzugefuegt', akteur, paketId, { userId, rolle });
    }
    return mapRow(result.rows[0]) || null;
}

export async function updateMitgliedRolle(paketId, userId, rolle, akteur) {
    const result = await query(
        `UPDATE flow_arbeitspaket_mitglied SET rolle = $1
         WHERE arbeitspaket_id = $2 AND user_id = $3
         RETURNING *`,
        [rolle, paketId, userId]
    );
    if (result.rows.length > 0) {
        await erstelleAktivitaet('rolle_geaendert', akteur, paketId, { userId, rolle });
    }
    return mapRow(result.rows[0]) || null;
}

export async function removeMitglied(paketId, userId, akteur) {
    const result = await query(
        `DELETE FROM flow_arbeitspaket_mitglied
         WHERE arbeitspaket_id = $1 AND user_id = $2
         RETURNING *`,
        [paketId, userId]
    );
    if (result.rows.length > 0) {
        await erstelleAktivitaet('mitglied_entfernt', akteur, paketId, { userId });
    }
    return mapRow(result.rows[0]) || null;
}

// ── Dashboard ──

export async function getDashboardDaten(userId) {
    const statistikResult = await query(
        `SELECT
            COUNT(*) FILTER (WHERE status = 'offen') AS offen,
            COUNT(*) FILTER (WHERE deadline < NOW() AND status != 'erledigt') AS ueberfaellig,
            COUNT(*) FILTER (WHERE status = 'erledigt' AND erledigt_at >= date_trunc('month', NOW())) AS erledigt_diesen_monat
         FROM flow_aufgabe WHERE zustaendig = $1`,
        [userId]
    );

    const aufgabenResult = await query(
        `SELECT a.*, ap.titel AS arbeitspaket_titel
         FROM flow_aufgabe a
         JOIN flow_arbeitspaket ap ON ap.id = a.arbeitspaket_id
         WHERE a.zustaendig = $1 AND a.status != 'erledigt'
         ORDER BY a.deadline NULLS LAST, a.created_at
         LIMIT 10`,
        [userId]
    );

    const paketeResult = await query(
        `SELECT ap.id, ap.titel, bg.name AS bildungsgang_name, ap.status, ap.deadline, apm.rolle AS meine_rolle,
                (SELECT COUNT(*) FILTER (WHERE status = 'erledigt') FROM flow_aufgabe WHERE arbeitspaket_id = ap.id) AS erledigt,
                (SELECT COUNT(*) FROM flow_aufgabe WHERE arbeitspaket_id = ap.id) AS gesamt
         FROM flow_arbeitspaket ap
         JOIN flow_arbeitspaket_mitglied apm ON apm.arbeitspaket_id = ap.id
         JOIN flow_bildungsgang bg ON bg.id = ap.bildungsgang_id
         WHERE apm.user_id = $1 AND ap.status IN ('aktiv', 'geplant')
         ORDER BY ap.deadline NULLS LAST`,
        [userId]
    );

    const tagungenResult = await query(
        `SELECT t.id, t.titel, t.start_at, t.raum, ap.titel AS arbeitspaket_titel,
                (SELECT COUNT(*) FROM flow_tagung_teilnehmer WHERE tagung_id = t.id) AS teilnehmende_count
         FROM flow_tagung t
         JOIN flow_arbeitspaket ap ON ap.id = t.arbeitspaket_id
         JOIN flow_tagung_teilnehmer tt ON tt.tagung_id = t.id
         WHERE tt.user_id = $1 AND t.start_at >= NOW()
         ORDER BY t.start_at
         LIMIT 5`,
        [userId]
    );

    const stat = statistikResult.rows[0];

    return {
        statistik: {
            offen: parseInt(stat.offen),
            ueberfaellig: parseInt(stat.ueberfaellig),
            erledigtDiesenMonat: parseInt(stat.erledigt_diesen_monat)
        },
        meineAufgaben: mapRows(aufgabenResult.rows),
        aktiveArbeitspakete: paketeResult.rows.map(p => {
            const mapped = mapRow(p);
            return { ...mapped, fortschritt: { erledigt: parseInt(p.erledigt), gesamt: parseInt(p.gesamt) } };
        }),
        naechsteTagungen: mapRows(tagungenResult.rows)
    };
}

// ── Abteilung ──

export async function getAbteilungsUebersicht() {
    const result = await query(
        `SELECT ap.id, ap.titel, ap.status, ap.deadline, bg.name AS bildungsgang
         FROM flow_arbeitspaket ap
         JOIN flow_bildungsgang bg ON bg.id = ap.bildungsgang_id
         ORDER BY bg.name, ap.status, ap.deadline NULLS LAST`
    );
    return mapRows(result.rows);
}

// ── Aktivitaeten ──

export async function getAktivitaeten(paketId, limit = 20) {
    const result = await query(
        `SELECT a.*,
                COALESCE(t.first_name, '') AS akteur_vorname,
                COALESCE(t.last_name, u.username) AS akteur_nachname
         FROM flow_aktivitaet a
         LEFT JOIN users u ON u.id = a.akteur
         LEFT JOIN teachers t ON t.id = u.teacher_id
         WHERE a.arbeitspaket_id = $1 AND a.restricted IS NOT TRUE
         ORDER BY a.created_at DESC
         LIMIT $2`,
        [paketId, limit]
    );
    return mapRows(result.rows).map(r => composeName(r, 'akteur'));
}

