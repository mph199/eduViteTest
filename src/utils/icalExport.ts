import type { TimeSlot as ApiSlot, TimeSlot as ApiBooking, Settings as ApiSettings } from '../types';

/**
 * Generiert eine iCal (.ics) Datei für Kalender-Export
 */

function parseDateToLocal(dateStr: string): Date {
  const raw = String(dateStr).trim();
  // Accept ISO (YYYY-MM-DD) or German (DD.MM.YYYY)
  let d: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    d = new Date(`${raw}T00:00:00`);
  } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split('.');
    d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  } else {
    // Try native parsing last (may be unreliable)
    d = new Date(raw);
  }
  if (!d || Number.isNaN(d.getTime())) throw new Error('Invalid date value');
  return d;
}

function normalizeTimeRange(timeStr: string): [number, number, number, number] {
  const cleaned = String(timeStr).replace(/,/, '').trim();
  const parts = cleaned.split(/\s*[-–—]\s*/);
  if (!parts[0] || !parts[1]) throw new Error('Invalid time range for ICS');
  const [sh, sm] = String(parts[0]).trim().split(':');
  const [eh, em] = String(parts[1]).trim().split(':');
  const sH = Number(sh), sM = Number(sm), eH = Number(eh), eM = Number(em);
  if ([sH, sM, eH, eM].some(n => Number.isNaN(n))) throw new Error('NaN time values');
  return [sH, sM, eH, eM];
}

function formatICalDateLocal(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) throw new Error('Invalid date/time for ICS');
  const date = parseDateToLocal(dateStr);
  const [sH, sM] = normalizeTimeRange(timeStr);
  date.setHours(sH, sM, 0, 0);

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function getEndTimeLocal(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) throw new Error('Invalid date/time for ICS');
  const date = parseDateToLocal(dateStr);
  const [, , eH, eM] = normalizeTimeRange(timeStr);
  date.setHours(eH, eM, 0, 0);

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function getCurrentTimestamp(): string {
  // DTSTAMP should be UTC
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

/**
 * Export einzelner gebuchter Slot als iCal für User
 */
export function exportSlotToICal(
  slot: ApiSlot,
  teacherName: string,
  settings?: ApiSettings
): void {
  let startDate: string;
  let endDate: string;
  try {
    startDate = formatICalDateLocal(slot.date, slot.time);
    endDate = getEndTimeLocal(slot.date, slot.time);
  } catch (e) {
    console.error('ICS export error (slot):', e);
    alert('Export fehlgeschlagen: Ungültiges Datum/Zeit im Termin. Bitte prüfen Sie die Terminzeit.');
    return;
  }
  const timestamp = getCurrentTimestamp();
  const eventName = settings?.event_name || 'BKSB Elternsprechtag';
  
  const icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BKSB Elternsprechtag//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
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
    'BEGIN:VEVENT',
    `UID:slot-${slot.id}@bksb-elternsprechtag.de`,
    `DTSTAMP:${timestamp}`,
    `DTSTART;TZID=Europe/Berlin:${startDate}`,
    `DTEND;TZID=Europe/Berlin:${endDate}`,
    `SUMMARY:${eventName} - ${teacherName}`,
    `DESCRIPTION:Elterngespräch mit ${teacherName}\\nSchüler/in: ${slot.studentName}\\nKlasse: ${slot.className}`,
    `LOCATION:BKSB`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Erinnerung: Elternsprechtag in 15 Minuten',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ].join('\r\n');

  downloadICalFile(icalContent, `Elternsprechtag-${teacherName}-${slot.time.replace(/[: ]/g, '')}.ics`);
}

/**
 * Export aller Buchungen für Admin als iCal
 */
export function exportBookingsToICal(
  bookings: ApiBooking[],
  settings?: ApiSettings
): void {
  const timestamp = getCurrentTimestamp();
  const eventName = settings?.event_name || 'BKSB Elternsprechtag';
  
  const events = bookings.map(booking => {
    try {
      const startDate = formatICalDateLocal(booking.date, booking.time);
      const endDate = getEndTimeLocal(booking.date, booking.time);
      return [
        'BEGIN:VEVENT',
        `UID:booking-${booking.id}@bksb-elternsprechtag.de`,
        `DTSTAMP:${timestamp}`,
        `DTSTART;TZID=Europe/Berlin:${startDate}`,
        `DTEND;TZID=Europe/Berlin:${endDate}`,
        `SUMMARY:${booking.teacherName} - ${booking.parentName}`,
        `DESCRIPTION:Schüler/in: ${booking.studentName}\\nKlasse: ${booking.className}\\nEltern: ${booking.parentName}`,
        `LOCATION:BKSB`,
        'STATUS:CONFIRMED',
        'SEQUENCE:0',
        'END:VEVENT'
      ].join('\r\n');
    } catch (e) {
      console.warn('Überspringe ungültigen Termin beim Export:', booking, e);
      return null;
    }
  }).filter(Boolean).join('\r\n');
  
  if (!events) {
    alert('Export fehlgeschlagen: Keine gültigen Termine gefunden. Bitte prüfen Sie die Daten.');
    return;
  }

  const icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BKSB Elternsprechtag//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
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
    `X-WR-CALNAME:${eventName} - Alle Buchungen`,
    `X-WR-CALDESC:Übersicht aller Termine für ${eventName}`,
    events,
    'END:VCALENDAR',
    ''
  ].join('\r\n');

  const dateStr = settings?.event_date ? new Date(settings.event_date).toISOString().split('T')[0] : 'termine';
  downloadICalFile(icalContent, `Elternsprechtag-Alle-Buchungen-${dateStr}.ics`);
}

/**
 * Export Slots einer Lehrkraft für Admin als iCal
 */
export function exportTeacherSlotsToICal(
  slots: ApiSlot[],
  teacherName: string,
  settings?: ApiSettings
): void {
  const timestamp = getCurrentTimestamp();
  const eventName = settings?.event_name || 'BKSB Elternsprechtag';
  const bookedSlots = slots.filter(s => s.booked);
  
  if (bookedSlots.length === 0) {
    alert('Keine gebuchten Termine für diese Lehrkraft vorhanden.');
    return;
  }
  
  const events = bookedSlots.map(slot => {
    try {
      const startDate = formatICalDateLocal(slot.date, slot.time);
      const endDate = getEndTimeLocal(slot.date, slot.time);
      return [
        'BEGIN:VEVENT',
        `UID:teacher-slot-${slot.id}@bksb-elternsprechtag.de`,
        `DTSTAMP:${timestamp}`,
        `DTSTART;TZID=Europe/Berlin:${startDate}`,
        `DTEND;TZID=Europe/Berlin:${endDate}`,
        `SUMMARY:${eventName} - ${slot.parentName}`,
        `DESCRIPTION:Schüler/in: ${slot.studentName}\\nKlasse: ${slot.className}\\nEltern: ${slot.parentName}`,
        `LOCATION:BKSB`,
        'STATUS:CONFIRMED',
        'SEQUENCE:0',
        'END:VEVENT'
      ].join('\r\n');
    } catch (e) {
      console.warn('Überspringe ungültigen Slot beim Export:', slot, e);
      return null;
    }
  }).filter(Boolean).join('\r\n');
  
  if (!events) {
    alert('Export fehlgeschlagen: Keine gültigen Slots gefunden. Bitte prüfen Sie die Daten.');
    return;
  }

  const icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BKSB Elternsprechtag//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
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
    `X-WR-CALNAME:${eventName} - ${teacherName}`,
    `X-WR-CALDESC:Termine für ${teacherName}`,
    events,
    'END:VCALENDAR',
    ''
  ].join('\r\n');

  downloadICalFile(icalContent, `Elternsprechtag-${teacherName}.ics`);
}

/**
 * Helper: Download iCal file
 */
function downloadICalFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
