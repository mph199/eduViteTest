import { query } from '../../../config/db.js';

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
    return result.rows;
}

export async function getBildungsgangDetail(bildungsgangId) {
    const bgResult = await query(
        'SELECT * FROM flow_bildungsgang WHERE id = $1',
        [bildungsgangId]
    );
    if (bgResult.rows.length === 0) return null;

    const mitgliederResult = await query(
        `SELECT bgm.id, bgm.user_id, u.vorname, u.nachname, bgm.rolle, bgm.hinzugefuegt_am
         FROM flow_bildungsgang_mitglied bgm
         JOIN users u ON u.id = bgm.user_id
         WHERE bgm.bildungsgang_id = $1
         ORDER BY bgm.rolle DESC, u.nachname`,
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
        ...bgResult.rows[0],
        mitglieder: mitgliederResult.rows,
        arbeitspakete: paketeResult.rows.map(p => ({
            ...p,
            fortschritt: { erledigt: parseInt(p.erledigt), gesamt: parseInt(p.gesamt) }
        }))
    };
}

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

    return paket;
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
        `SELECT apm.id, apm.user_id, u.vorname, u.nachname, apm.rolle, apm.hinzugefuegt_am
         FROM flow_arbeitspaket_mitglied apm
         JOIN users u ON u.id = apm.user_id
         WHERE apm.arbeitspaket_id = $1
         ORDER BY apm.rolle, u.nachname`,
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
        ...ap,
        mitglieder: mitgliederResult.rows,
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

    return result.rows[0] || null;
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

    return { paket: result.rows[0] };
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
    return result.rows[0];
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
    return result.rows[0];
}

// ── Mitglieder ──

export async function getMitglieder(paketId) {
    const result = await query(
        `SELECT apm.id, apm.user_id, u.vorname, u.nachname, apm.rolle, apm.hinzugefuegt_am
         FROM flow_arbeitspaket_mitglied apm
         JOIN users u ON u.id = apm.user_id
         WHERE apm.arbeitspaket_id = $1
         ORDER BY apm.rolle, u.nachname`,
        [paketId]
    );
    return result.rows;
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
    return result.rows[0] || null;
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
    return result.rows[0] || null;
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
    return result.rows[0] || null;
}

// ── Aufgaben ──

export async function getAufgaben(paketId) {
    const result = await query(
        `SELECT a.*, u.vorname AS zustaendig_vorname, u.nachname AS zustaendig_nachname
         FROM flow_aufgabe a
         LEFT JOIN users u ON u.id = a.zustaendig
         WHERE a.arbeitspaket_id = $1
         ORDER BY a.status, a.deadline NULLS LAST, a.created_at`,
        [paketId]
    );
    return result.rows;
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

    return result.rows[0];
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
    return result.rows[0] || null;
}

export async function updateAufgabeStatus(aufgabeId, status, userId) {
    const erledigtAt = status === 'erledigt' ? 'NOW()' : 'NULL';
    const result = await query(
        `UPDATE flow_aufgabe SET status = $1, erledigt_at = ${erledigtAt}, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, aufgabeId]
    );
    if (result.rows.length === 0) return null;

    const aufgabe = result.rows[0];
    await erstelleAktivitaet('aufgabe_status_geaendert', userId, aufgabe.arbeitspaket_id, {
        aufgabeId, status
    });
    return aufgabe;
}

export async function deleteAufgabe(aufgabeId, userId) {
    const aufgabe = await query('SELECT * FROM flow_aufgabe WHERE id = $1', [aufgabeId]);
    if (aufgabe.rows.length === 0) return null;

    await query('DELETE FROM flow_aufgabe WHERE id = $1', [aufgabeId]);
    await erstelleAktivitaet('aufgabe_geloescht', userId, aufgabe.rows[0].arbeitspaket_id, {
        aufgabeId, titel: aufgabe.rows[0].titel
    });
    return aufgabe.rows[0];
}

export async function getMeineAufgaben(userId, filter = {}) {
    let where = 'a.zustaendig = $1';
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
                u.vorname AS zustaendig_vorname, u.nachname AS zustaendig_nachname
         FROM flow_aufgabe a
         JOIN flow_arbeitspaket ap ON ap.id = a.arbeitspaket_id
         LEFT JOIN users u ON u.id = a.zustaendig
         WHERE ${where}
         ORDER BY a.deadline NULLS LAST, a.created_at`,
        values
    );
    return result.rows;
}

// ── Tagungen ──

export async function getTagungen(paketId) {
    const result = await query(
        `SELECT t.*, (SELECT COUNT(*) FROM flow_tagung_teilnehmer WHERE tagung_id = t.id) AS teilnehmende_count
         FROM flow_tagung t
         WHERE t.arbeitspaket_id = $1
         ORDER BY t.start_at DESC`,
        [paketId]
    );
    return result.rows;
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

    return tagung;
}

export async function getTagungDetail(tagungId) {
    const tagungResult = await query('SELECT * FROM flow_tagung WHERE id = $1', [tagungId]);
    if (tagungResult.rows.length === 0) return null;

    const teilnehmerResult = await query(
        `SELECT tt.user_id, u.vorname, u.nachname
         FROM flow_tagung_teilnehmer tt
         JOIN users u ON u.id = tt.user_id
         WHERE tt.tagung_id = $1
         ORDER BY u.nachname`,
        [tagungId]
    );

    const agendaResult = await query(
        `SELECT * FROM flow_agenda_punkt
         WHERE tagung_id = $1
         ORDER BY sortierung, created_at`,
        [tagungId]
    );

    return {
        ...tagungResult.rows[0],
        teilnehmende: teilnehmerResult.rows,
        agendaPunkte: agendaResult.rows
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
    return result.rows[0] || null;
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
    return result.rows[0];
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
    values.push(punktId);

    const result = await query(
        `UPDATE flow_agenda_punkt SET ${sets.join(', ')}
         WHERE id = $${idx}
         RETURNING *`,
        values
    );
    return result.rows[0] || null;
}

// ── Dateien ──

export async function getDateien(paketId) {
    const result = await query(
        `SELECT d.*, u.vorname AS hochgeladen_von_vorname, u.nachname AS hochgeladen_von_nachname
         FROM flow_datei d
         LEFT JOIN users u ON u.id = d.hochgeladen_von
         WHERE d.arbeitspaket_id = $1
         ORDER BY d.created_at DESC`,
        [paketId]
    );
    return result.rows;
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

    return result.rows[0];
}

export async function deleteDatei(dateiId) {
    await query('DELETE FROM flow_datei WHERE id = $1', [dateiId]);
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
        meineAufgaben: aufgabenResult.rows,
        aktiveArbeitspakete: paketeResult.rows.map(p => ({
            ...p,
            fortschritt: { erledigt: parseInt(p.erledigt), gesamt: parseInt(p.gesamt) }
        })),
        naechsteTagungen: tagungenResult.rows
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
    return result.rows;
}

// ── Aktivitaeten ──

export async function getAktivitaeten(paketId, limit = 20) {
    const result = await query(
        `SELECT a.*, u.vorname AS akteur_vorname, u.nachname AS akteur_nachname
         FROM flow_aktivitaet a
         LEFT JOIN users u ON u.id = a.akteur
         WHERE a.arbeitspaket_id = $1
         ORDER BY a.created_at DESC
         LIMIT $2`,
        [paketId, limit]
    );
    return result.rows;
}

export async function erstelleAktivitaet(typ, akteur, arbeitspaketId, details) {
    await query(
        `INSERT INTO flow_aktivitaet (typ, akteur, arbeitspaket_id, details)
         VALUES ($1, $2, $3, $4)`,
        [typ, akteur, arbeitspaketId, JSON.stringify(details)]
    );
}

// ── Hilfsfunktionen ──

function camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}
