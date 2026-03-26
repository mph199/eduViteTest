import { describe, it, expect, vi } from 'vitest';

// Mock logger before importing icalGenerator
vi.mock('../../config/logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const { generateCounselorICS } = await import('../icalGenerator.js');

describe('generateCounselorICS', () => {
  const baseConfig = {
    appointments: [
      { id: 1, date: '2026-03-15', time: '10:00-10:30' },
      { id: 2, date: '2026-03-16', time: '14:00-14:45' },
    ],
    counselorName: 'Max Mustermann',
    calendarTitle: 'Beratungslehrer-Termine',
    uidPrefix: 'bl-appointment',
    uidDomain: 'test.schule.de',
  };

  it('generiert valides ICS mit BEGIN/END VCALENDAR', () => {
    const ics = generateCounselorICS(baseConfig);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('METHOD:PUBLISH');
  });

  it('enthält VEVENT-Blöcke für jeden Termin', () => {
    const ics = generateCounselorICS(baseConfig);
    const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(eventCount).toBe(2);
  });

  it('DATENSCHUTZ: SUMMARY enthält nur "Beratungstermin" — keine Personendaten', () => {
    const config = {
      ...baseConfig,
      appointments: [{ id: 99, date: '2026-03-15', time: '10:00-10:30' }],
    };
    const ics = generateCounselorICS(config);
    // SUMMARY muss genau "Beratungstermin" sein
    expect(ics).toContain('SUMMARY:Beratungstermin');
    // Darf NICHT den Counselor-Namen oder Schülernamen enthalten
    expect(ics).not.toMatch(/SUMMARY:.*Mustermann/);
    expect(ics).not.toMatch(/SUMMARY:.*Max/);
  });

  it('DATENSCHUTZ: Kein DESCRIPTION-Feld in Events', () => {
    const ics = generateCounselorICS(baseConfig);
    // Events sollten kein DESCRIPTION haben (Datenschutz)
    const lines = ics.split('\r\n');
    const descLines = lines.filter(l => l.startsWith('DESCRIPTION:'));
    expect(descLines.length).toBe(0);
  });

  it('generiert korrekte UIDs mit Prefix und Domain', () => {
    const ics = generateCounselorICS(baseConfig);
    expect(ics).toContain('UID:bl-appointment-1@test.schule.de');
    expect(ics).toContain('UID:bl-appointment-2@test.schule.de');
  });

  it('enthält Berliner Zeitzone', () => {
    const ics = generateCounselorICS(baseConfig);
    expect(ics).toContain('TZID:Europe/Berlin');
    expect(ics).toContain('BEGIN:VTIMEZONE');
  });

  it('enthält Kalendertitel mit Counselor-Name', () => {
    const ics = generateCounselorICS(baseConfig);
    expect(ics).toMatch(/X-WR-CALNAME:.*Beratungslehrer-Termine.*Max Mustermann/);
  });

  it('überspringt Termine mit ungültigem Zeitformat ohne Crash', () => {
    const config = {
      ...baseConfig,
      appointments: [
        { id: 1, date: '2026-03-15', time: 'invalid' },
        { id: 2, date: '2026-03-16', time: '14:00-14:45' },
      ],
    };
    const ics = generateCounselorICS(config);
    const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(eventCount).toBe(1);
  });

  it('überspringt Termine mit ungültigem Datum ohne Crash', () => {
    const config = {
      ...baseConfig,
      appointments: [
        { id: 1, date: 'not-a-date', time: '10:00-10:30' },
      ],
    };
    const ics = generateCounselorICS(config);
    const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(eventCount).toBe(0);
    expect(ics).toContain('BEGIN:VCALENDAR');
  });

  it('gibt valides ICS bei leerer Terminliste', () => {
    const config = { ...baseConfig, appointments: [] };
    const ics = generateCounselorICS(config);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('parst DD.MM.YYYY Datumsformat korrekt', () => {
    const config = {
      ...baseConfig,
      appointments: [{ id: 1, date: '15.03.2026', time: '10:00-10:30' }],
    };
    const ics = generateCounselorICS(config);
    expect(ics).toContain('DTSTART;TZID=Europe/Berlin:20260315T100000');
  });

  it('verwendet Custom PRODID wenn angegeben', () => {
    const config = { ...baseConfig, prodId: '-//TEST//Custom//DE' };
    const ics = generateCounselorICS(config);
    expect(ics).toContain('PRODID:-//TEST//Custom//DE');
  });
});
