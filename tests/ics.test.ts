import { describe, expect, it } from 'vitest';
import { buildIcsCalendar, escapeIcsText, foldIcsLine, icsFileName } from '@/lib/ics';

const now = new Date('2026-09-01T10:00:00Z');

function lines(calendar: string): string[] {
  return calendar.split('\r\n');
}

describe('escapeIcsText', () => {
  it('escapes the RFC 5545 special characters', () => {
    expect(escapeIcsText('a,b;c\\d')).toBe('a\\,b\\;c\\\\d');
  });

  it('turns line breaks into literal \\n', () => {
    expect(escapeIcsText('first\r\nsecond\nthird')).toBe('first\\nsecond\\nthird');
  });

  it('leaves plain text untouched', () => {
    expect(escapeIcsText('Tag der offenen Tür')).toBe('Tag der offenen Tür');
  });
});

describe('foldIcsLine', () => {
  it('leaves short lines alone', () => {
    expect(foldIcsLine('SUMMARY:short')).toBe('SUMMARY:short');
  });

  it('folds long lines with CRLF + space and keeps every octet line <= 75', () => {
    const folded = foldIcsLine(`DESCRIPTION:${'a'.repeat(400)}`);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
    // Unfolding (remove CRLF + leading space) restores the original content.
    expect(folded.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'a'.repeat(400)}`);
  });

  it('never splits a multi-byte character', () => {
    const folded = foldIcsLine(`SUMMARY:${'ü'.repeat(80)}`);
    expect(folded.replace(/\r\n /g, '')).toBe(`SUMMARY:${'ü'.repeat(80)}`);
    expect(folded).not.toContain('�');
  });
});

describe('buildIcsCalendar', () => {
  it('emits a well-formed calendar envelope', () => {
    const calendar = buildIcsCalendar(
      { id: 'evt1', title: 'Tag der offenen Tür', eventDate: new Date('2027-01-15T00:00:00Z') },
      now,
    );

    expect(calendar.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(calendar.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(lines(calendar)).toContain('VERSION:2.0');
    expect(lines(calendar)).toContain('DTSTAMP:20260901T100000Z');
    expect(lines(calendar)).toContain('UID:evt1@schulkompass.nrw');
  });

  it('converts a winter start time from Berlin local time to UTC', () => {
    const calendar = buildIcsCalendar(
      {
        id: 'evt2',
        title: 'Informationsabend',
        eventDate: new Date('2027-01-15T00:00:00Z'),
        startTime: '18:30',
        endTime: '20:00',
      },
      now,
    );

    // CET = UTC+1
    expect(lines(calendar)).toContain('DTSTART:20270115T173000Z');
    expect(lines(calendar)).toContain('DTEND:20270115T190000Z');
  });

  it('converts a summer start time using CEST', () => {
    const calendar = buildIcsCalendar(
      {
        id: 'evt3',
        title: 'Sommerfest',
        eventDate: new Date('2027-07-01T00:00:00Z'),
        startTime: '10:00',
        endTime: '14:00',
      },
      now,
    );

    // CEST = UTC+2
    expect(lines(calendar)).toContain('DTSTART:20270701T080000Z');
    expect(lines(calendar)).toContain('DTEND:20270701T120000Z');
  });

  it('uses a non-inclusive DATE range for all-day entries', () => {
    const calendar = buildIcsCalendar(
      { id: 'evt4', title: 'Anmeldezeitraum', eventDate: new Date('2027-02-10T00:00:00Z') },
      now,
    );

    expect(lines(calendar)).toContain('DTSTART;VALUE=DATE:20270210');
    expect(lines(calendar)).toContain('DTEND;VALUE=DATE:20270211');
  });

  it('rolls an all-day entry over a month boundary correctly', () => {
    const calendar = buildIcsCalendar(
      { id: 'evt5', title: 'Anmeldung', eventDate: new Date('2027-02-28T00:00:00Z') },
      now,
    );
    expect(lines(calendar)).toContain('DTEND;VALUE=DATE:20270301');
  });

  it('falls back to a two-hour duration when the end time precedes the start', () => {
    const calendar = buildIcsCalendar(
      {
        id: 'evt6',
        title: 'Fehlerhafter Termin',
        eventDate: new Date('2027-01-15T00:00:00Z'),
        startTime: '18:00',
        endTime: '09:00',
      },
      now,
    );

    expect(lines(calendar)).toContain('DTSTART:20270115T170000Z');
    expect(lines(calendar)).toContain('DTEND:20270115T190000Z');
  });

  it('escapes user-provided text and includes optional fields', () => {
    const calendar = buildIcsCalendar(
      {
        id: 'evt7',
        title: 'Info; Klasse 4, 5',
        description: 'Zeile 1\nZeile 2',
        location: 'Aula, Haupthaus',
        url: 'https://example.org/schools/1',
        eventDate: new Date('2027-01-15T00:00:00Z'),
        uidDomain: 'schulkompass.example',
      },
      now,
    );

    expect(calendar).toContain('SUMMARY:Info\\; Klasse 4\\, 5');
    expect(calendar).toContain('DESCRIPTION:Zeile 1\\nZeile 2');
    expect(calendar).toContain('LOCATION:Aula\\, Haupthaus');
    expect(calendar).toContain('URL:https://example.org/schools/1');
    expect(calendar).toContain('UID:evt7@schulkompass.example');
  });

  it('uses the Berlin calendar day even when the stored instant is the previous UTC day', () => {
    const calendar = buildIcsCalendar(
      {
        id: 'evt8',
        title: 'Grenzfall',
        // 22:30 UTC on 30 June is already 1 July in Berlin.
        eventDate: new Date('2027-06-30T22:30:00Z'),
      },
      now,
    );
    expect(lines(calendar)).toContain('DTSTART;VALUE=DATE:20270701');
  });
});

describe('icsFileName', () => {
  it('transliterates umlauts and builds a dated slug', () => {
    expect(icsFileName('Tag der offenen Tür', new Date('2027-01-15T00:00:00Z'))).toBe(
      '20270115-tag-der-offenen-tuer.ics',
    );
  });

  it('falls back to a generic name when nothing survives slugification', () => {
    expect(icsFileName('!!!', new Date('2027-01-15T00:00:00Z'))).toBe('20270115-termin.ics');
  });

  it('never produces path separators', () => {
    expect(icsFileName('../../etc/passwd', new Date('2027-01-15T00:00:00Z'))).toBe(
      '20270115-etc-passwd.ics',
    );
  });
});
