/**
 * Server-seitiger ICS-Generator für Kalender-Abo-Feeds.
 *
 * Port der reinen Generierungsfunktionen aus src/utils/icalExport.ts,
 * ohne DOM-APIs (kein alert, Blob, TextEncoder etc.).
 *
 * Aktuell ausschließlich für Eltern- und Ausbildersprechtag.
 */

import logger from '../../../config/logger.js';

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function escapeICalText(value) {
  const raw = String(value ?? '').trim();
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldICalLine(line) {
  const bytes = Buffer.byteLength(line, 'utf8');
  if (bytes <= 75) return line;

  let out = '';
  let chunk = '';
  let chunkBytes = 0;

  for (const ch of line) {
    const b = Buffer.byteLength(ch, 'utf8');
    if (chunkBytes + b > 75) {
      out += (out ? '\r\n ' : '') + chunk;
      chunk = ch;
      chunkBytes = b;
    } else {
      chunk += ch;
      chunkBytes += b;
    }
  }

  if (chunk) out += (out ? '\r\n ' : '') + chunk;
  return out;
}

function buildICalContent(lines) {
  const folded = lines
    .flatMap((l) => String(l).split(/\r\n|\r|\n/))
    .map((l) => foldICalLine(l));
  return `${folded.join('\r\n')}\r\n`;
}

const pad = (n) => String(n).padStart(2, '0');

function getCurrentTimestamp() {
  const now = new Date();
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

// ---------------------------------------------------------------------------
// Datums- / Zeitparsing (robust)
// ---------------------------------------------------------------------------

/**
 * Extrahiert YYYYMMDD aus einem Datum-String (ISO oder DD.MM.YYYY).
 * Verwendet kein JS-Date, um Zeitzonen-Probleme auf UTC-Servern zu vermeiden.
 * Gibt null zurück bei ungültigem Format.
 */
function parseDateToICalDate(dateStr) {
  const raw = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw.replace(/-/g, '');
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split('.');
    return `${yyyy}${mm}${dd}`;
  }
  return null;
}

/**
 * Parst einen Zeit-String wie "16:00-16:15" oder "16:00 - 16:15" robust.
 * Gibt { start, end } als [h, m]-Arrays zurück oder null bei Fehler.
 */
function parseSlotTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.split(/\s*[-–—]\s*/);
  if (parts.length < 2) return null;

  const extract = (part) => {
    const m = String(part).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return [Number(m[1]), Number(m[2])];
  };

  const start = extract(parts[0]);
  const end = extract(parts[1]);
  if (!start || !end) return null;
  return { start, end };
}

/**
 * Formatiert ein ICS-Datetime aus YYYYMMDD-String und Stunden/Minuten.
 * Kein JS-Date nötig — zeitzonen-unabhängig.
 */
function formatICalDateTime(icalDate, hours, minutes) {
  return `${icalDate}T${pad(hours)}${pad(minutes)}00`;
}

// ---------------------------------------------------------------------------
// Visitor-Details (Eltern- und Ausbildersprechtag)
// ---------------------------------------------------------------------------

function buildVisitorDetails(slot) {
  const safeClassName = (slot.class_name || '').trim() || 'nicht angegeben';

  if (slot.visitor_type === 'company') {
    const safeCompanyName = (slot.company_name || '').trim() || 'nicht angegeben';
    const safeRepName = (slot.representative_name || '').trim() || 'nicht angegeben';
    const safeTraineeName = (slot.trainee_name || slot.student_name || '').trim() || 'nicht angegeben';
    const initial = safeTraineeName.charAt(0);
    // Azubi-Nachname extrahieren (letztes Wort)
    const nameParts = safeTraineeName.split(/\s+/);
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : safeTraineeName;
    return {
      summary: `${initial}. ${lastName} (${safeClassName})`,
      description: `Ausbildungsbetrieb: ${safeCompanyName}\nVertreter*in: ${safeRepName}\nAzubi: ${safeTraineeName}\nKlasse: ${safeClassName}`,
    };
  }

  const safeParentName = (slot.parent_name || '').trim() || 'nicht angegeben';
  const safeStudentName = (slot.student_name || '').trim() || 'nicht angegeben';
  const initial = safeStudentName.charAt(0);
  const nameParts = safeStudentName.split(/\s+/);
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : safeStudentName;
  return {
    summary: `${initial}. ${lastName} (${safeClassName})`,
    description: `Erziehungsberechtigte: ${safeParentName}\nKlasse: ${safeClassName}`,
  };
}

// ---------------------------------------------------------------------------
// VCALENDAR-Grundstruktur
// ---------------------------------------------------------------------------

const VTIMEZONE_BERLIN = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Berlin',
  'X-LIC-LOCATION:Europe/Berlin',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

// ---------------------------------------------------------------------------
// Hauptfunktion
// ---------------------------------------------------------------------------

/**
 * Generiert einen vollständigen ICS-Feed für eine Lehrkraft.
 *
 * @param {Array} slots - DB-Rows mit id, date, time, status, student_name, parent_name, class_name, visitor_type, company_name, representative_name, trainee_name
 * @param {string} teacherName - Anzeigename der Lehrkraft
 * @param {string} teacherRoom - Raum der Lehrkraft
 * @param {string} eventName - Name des Events (z.B. "BKSB Eltern- und Ausbildersprechtag")
 * @param {string} uidDomain - Stabile Domain für UIDs (aus Config, nie aus Request)
 * @returns {string} Vollständiger ICS-String
 */
export function generateTeacherICS(slots, teacherName, teacherRoom, eventName, uidDomain) {
  const timestamp = getCurrentTimestamp();
  const safeDomain = uidDomain || 'calendar.schule.de';
  const safeEventName = eventName || 'Eltern- und Ausbildersprechtag';
  const location = teacherRoom ? `Raum ${teacherRoom}` : '';

  const events = [];

  for (const slot of slots) {
    try {
      const parsed = parseSlotTime(slot.time);
      if (!parsed) {
        logger.warn({ slotId: slot.id, time: slot.time }, 'Kalender-Feed: ungültiges Zeitformat, Slot übersprungen');
        continue;
      }

      const icalDate = parseDateToICalDate(slot.date);
      if (!icalDate) {
        logger.warn({ slotId: slot.id, date: slot.date }, 'Kalender-Feed: ungültiges Datum, Slot übersprungen');
        continue;
      }

      const dtStart = formatICalDateTime(icalDate, parsed.start[0], parsed.start[1]);
      const dtEnd = formatICalDateTime(icalDate, parsed.end[0], parsed.end[1]);
      const visitor = buildVisitorDetails(slot);

      events.push(
        'BEGIN:VEVENT',
        `UID:elternsprechtag-slot-${slot.id}@${safeDomain}`,
        `DTSTAMP:${timestamp}`,
        `DTSTART;TZID=Europe/Berlin:${dtStart}`,
        `DTEND;TZID=Europe/Berlin:${dtEnd}`,
        `SUMMARY:${escapeICalText(`${safeEventName} – ${visitor.summary}`)}`,
        `DESCRIPTION:${escapeICalText(visitor.description)}`,
        ...(location ? [`LOCATION:${escapeICalText(location)}`] : []),
        'STATUS:CONFIRMED',
        'SEQUENCE:0',
        'END:VEVENT',
      );
    } catch (err) {
      logger.error({ err, slotId: slot.id }, 'Kalender-Feed: Fehler beim Generieren eines Events, Slot übersprungen');
    }
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BKSB//Eltern- und Ausbildersprechtag//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICalText(`${safeEventName} – ${teacherName}`)}`,
    'X-WR-TIMEZONE:Europe/Berlin',
    ...VTIMEZONE_BERLIN,
    ...events,
    'END:VCALENDAR',
  ];

  return buildICalContent(lines);
}
