/**
 * CSV parsing and column-mapping helpers extracted from teacherRoutes.js.
 * Supports both semicolon and comma delimiters, quoted fields.
 */

/**
 * Parse CSV text into headers + row objects.
 * @param {string} text – Raw CSV content
 * @returns {{ headers: string[], rows: Record<string, string>[] }}
 */
export function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ';' || ch === ',') { fields.push(current.trim()); current = ''; }
        else { current += ch; }
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headerLine = lines.findIndex(l => l.trim().length > 0);
  if (headerLine < 0) return { headers: [], rows: [] };
  const headers = parseLine(lines[headerLine]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = [];
  for (let i = headerLine + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseLine(line);
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
    rows.push(row);
  }
  return { headers, rows };
}

/**
 * Known column aliases for teacher CSV import.
 */
export const COL_ALIASES = {
  last_name:  ['nachname', 'last_name', 'lastname', 'familienname', 'name'],
  first_name: ['vorname', 'first_name', 'firstname'],
  email:      ['email', 'e-mail', 'e_mail', 'mail'],
  salutation: ['anrede', 'salutation'],
  room:       ['raum', 'room', 'zimmer'],
  subject:    ['fach', 'subject', 'fächer'],
  available_from:  ['von', 'from', 'available_from', 'sprechzeit_von'],
  available_until: ['bis', 'until', 'available_until', 'sprechzeit_bis'],
};

/**
 * Map CSV headers to canonical field names using COL_ALIASES.
 * @param {string[]} headers
 * @returns {Record<string, string>}
 */
export function mapColumns(headers) {
  const mapping = {};
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    const found = headers.find(h => aliases.includes(h));
    if (found) mapping[field] = found;
  }
  return mapping;
}
