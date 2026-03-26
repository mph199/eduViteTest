/**
 * Shared ICS-Generator für Kalender-Abo-Feeds.
 *
 * Generalisierte Version der Elternsprechtag-icalGenerator.js.
 * Wird von BL, SSW und potenziell weiteren Modulen genutzt.
 *
 * Datenschutz-Vorgabe: ICS-Feeds landen bei externen Kalenderdiensten
 * (Google, Apple, Microsoft). Deshalb nur minimale Daten exportieren.
 */

import logger from '../config/logger.js';

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
 */
function parseSlotTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.split(/\s*[-\u2013\u2014]\s*/);
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

function formatICalDateTime(icalDate, hours, minutes) {
  return `${icalDate}T${pad(hours)}${pad(minutes)}00`;
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
// Counselor-ICS-Generator
// ---------------------------------------------------------------------------

/**
 * Generiert einen ICS-Feed für Counselor-Termine (BL/SSW).
 *
 * Datenschutz: Standardmäßig neutraler Titel ("Beratungstermin")
 * ohne Personendaten. Keine Schülernamen, Klassen oder E-Mails
 * in SUMMARY oder DESCRIPTION.
 *
 * @param {Object} config
 * @param {Array} config.appointments - DB-Rows mit id, date, time
 * @param {string} config.counselorName - Anzeigename des Counselors
 * @param {string} config.calendarTitle - Kalendertitel (z.B. "Beratungslehrer-Termine")
 * @param {string} config.uidPrefix - Prefix für UIDs (z.B. "bl-appointment", "ssw-appointment")
 * @param {string} config.uidDomain - Stabile Domain für UIDs
 * @param {string} [config.prodId] - PRODID für den Kalender
 * @returns {string} Vollständiger ICS-String
 */
export function generateCounselorICS(config) {
  const {
    appointments,
    counselorName,
    calendarTitle,
    uidPrefix,
    uidDomain,
    prodId = '-//BKSB//Beratungstermine//DE',
  } = config;

  const timestamp = getCurrentTimestamp();
  const safeDomain = uidDomain || 'calendar.schule.de';
  const safeTitle = calendarTitle || 'Beratungstermine';

  const events = [];

  for (const appt of appointments) {
    try {
      const parsed = parseSlotTime(appt.time);
      if (!parsed) {
        logger.warn({ appointmentId: appt.id, time: appt.time }, 'Kalender-Feed: ungültiges Zeitformat, Termin übersprungen');
        continue;
      }

      const icalDate = parseDateToICalDate(appt.date);
      if (!icalDate) {
        logger.warn({ appointmentId: appt.id, date: appt.date }, 'Kalender-Feed: ungültiges Datum, Termin übersprungen');
        continue;
      }

      const dtStart = formatICalDateTime(icalDate, parsed.start[0], parsed.start[1]);
      const dtEnd = formatICalDateTime(icalDate, parsed.end[0], parsed.end[1]);

      events.push(
        'BEGIN:VEVENT',
        `UID:${uidPrefix}-${appt.id}@${safeDomain}`,
        `DTSTAMP:${timestamp}`,
        `DTSTART;TZID=Europe/Berlin:${dtStart}`,
        `DTEND;TZID=Europe/Berlin:${dtEnd}`,
        `SUMMARY:${escapeICalText('Beratungstermin')}`,
        'STATUS:CONFIRMED',
        'SEQUENCE:0',
        'END:VEVENT',
      );
    } catch (err) {
      logger.error({ err, appointmentId: appt.id }, 'Kalender-Feed: Fehler beim Generieren eines Events, Termin übersprungen');
    }
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICalText(`${safeTitle} \u2013 ${counselorName}`)}`,
    'X-WR-TIMEZONE:Europe/Berlin',
    ...VTIMEZONE_BERLIN,
    ...events,
    'END:VCALENDAR',
  ];

  return buildICalContent(lines);
}
