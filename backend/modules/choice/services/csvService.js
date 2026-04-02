/**
 * CSV-Import-Service fuer Choice-Teilnehmer.
 *
 * Nutzt die zentrale parseCSV-Funktion und definiert
 * Participant-spezifische Spalten-Aliase.
 */

import { parseCSV } from '../../../utils/csvImport.js';
import { EMAIL_RE } from '../../../utils/validators.js';

const PARTICIPANT_COL_ALIASES = {
  last_name: ['nachname', 'last_name', 'lastname', 'familienname', 'name'],
  first_name: ['vorname', 'first_name', 'firstname'],
  email: ['email', 'e-mail', 'e_mail', 'mail'],
  audience_label: ['klasse', 'klasse/kurs', 'kurs', 'gruppe', 'audience', 'audience_label', 'label'],
};

/**
 * Map CSV headers to canonical field names.
 * @param {string[]} headers
 * @returns {Record<string, string>}
 */
function mapParticipantColumns(headers) {
  const mapping = {};
  for (const [field, aliases] of Object.entries(PARTICIPANT_COL_ALIASES)) {
    const found = headers.find((h) => aliases.includes(h));
    if (found) mapping[field] = found;
  }
  return mapping;
}

/**
 * Parse CSV buffer and return validated participant rows.
 *
 * @param {Buffer} buffer – CSV file content
 * @param {Set<string>} existingEmails – E-Mails already in the group (lowercase)
 * @returns {{ toInsert: object[], skipped: object[], errors: string[] }}
 */
export function parseParticipantCSV(buffer, existingEmails) {
  const text = buffer.toString('utf-8');
  const { headers, rows } = parseCSV(text);

  if (!rows.length) {
    return { toInsert: [], skipped: [], errors: ['Die CSV-Datei enthält keine Datenzeilen.'] };
  }

  const colMap = mapParticipantColumns(headers);
  const errors = [];

  if (!colMap.last_name) {
    errors.push(`Pflicht-Spalte "Nachname" nicht gefunden. Erkannte Spalten: ${headers.join(', ')}`);
  }
  if (!colMap.email) {
    errors.push(`Pflicht-Spalte "Email" nicht gefunden. Erkannte Spalten: ${headers.join(', ')}`);
  }
  if (errors.length) {
    return { toInsert: [], skipped: [], errors };
  }

  const toInsert = [];
  const skipped = [];
  const seenEmails = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;

    const lastName = (row[colMap.last_name] || '').trim();
    const firstName = colMap.first_name ? (row[colMap.first_name] || '').trim() : '';
    const rawEmail = (row[colMap.email] || '').trim().toLowerCase();
    const audienceLabel = colMap.audience_label ? (row[colMap.audience_label] || '').trim() || null : null;

    if (!lastName) {
      skipped.push({ line: lineNum, reason: 'Nachname fehlt' });
      continue;
    }

    if (!firstName) {
      skipped.push({ line: lineNum, reason: 'Vorname fehlt', name: lastName });
      continue;
    }

    if (!rawEmail || !EMAIL_RE.test(rawEmail)) {
      skipped.push({ line: lineNum, reason: `Ungültige E-Mail: ${rawEmail || '(leer)'}`, name: `${firstName} ${lastName}`.trim() });
      continue;
    }

    if (seenEmails.has(rawEmail)) {
      skipped.push({ line: lineNum, reason: `Duplikat in CSV: ${rawEmail}`, name: `${firstName} ${lastName}`.trim() });
      continue;
    }

    if (existingEmails.has(rawEmail)) {
      skipped.push({ line: lineNum, reason: `E-Mail existiert bereits in dieser Gruppe: ${rawEmail}`, name: `${firstName} ${lastName}`.trim() });
      continue;
    }

    seenEmails.add(rawEmail);
    toInsert.push({
      first_name: firstName,
      last_name: lastName,
      email: rawEmail,
      audience_label: audienceLabel,
    });
  }

  return { toInsert, skipped, errors: [] };
}
