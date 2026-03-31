import { db } from '../../../db/database.js';

export function camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function snakeToCamel(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        result[camelKey] = value;
    }
    return result;
}

export function mapRow(row) {
    return row ? snakeToCamel(row) : null;
}

export function mapRows(rows) {
    return rows.map(snakeToCamel);
}

export function composeName(row, prefix) {
    const vornameKey = `${prefix}Vorname`;
    const nachnameKey = `${prefix}Nachname`;
    const nameKey = `${prefix}Name`;
    const vorname = row[vornameKey] || '';
    const nachname = row[nachnameKey] || '';
    row[nameKey] = `${vorname} ${nachname}`.trim();
    delete row[vornameKey];
    delete row[nachnameKey];
    return row;
}

export async function erstelleAktivitaet(typ, akteur, arbeitspaketId, details) {
    await db.insertInto('flow_aktivitaet')
        .values({
            typ,
            akteur,
            arbeitspaket_id: arbeitspaketId,
            details: JSON.stringify(details)
        })
        .execute();
}
