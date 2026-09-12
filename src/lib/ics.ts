import { APP_TIME_ZONE, parseTimeString, zonedDateParts, zonedTimeToUtc } from './datetime';

export interface IcsEventInput {
  /** Stable identifier, used to build the UID. */
  id: string;
  title: string;
  description?: string | null;
  /** Calendar day of the event; the time-of-day part is ignored. */
  eventDate: Date;
  /** Local start time "HH:mm" in Europe/Berlin. Omit for an all-day entry. */
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  url?: string | null;
  /** Host name used for the UID domain part. */
  uidDomain?: string;
}

const CRLF = '\r\n';
const PRODID = '-//SchulKompass NRW//Schultermine//DE';

/** RFC 5545 §3.3.11 text escaping. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * RFC 5545 §3.1 content line folding: lines must not exceed 75 octets.
 * Folding happens on octet boundaries of the UTF-8 encoding, never inside a
 * multi-byte sequence.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  if (encoder.encode(line).length <= 75) return line;

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;
  // First line may use 75 octets, continuation lines 74 (one octet is the
  // leading space).
  let limit = 75;

  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    if (currentBytes + charBytes > limit) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
      limit = 74;
    }
    current += char;
    currentBytes += charBytes;
  }
  if (current.length > 0) chunks.push(current);

  // decoder keeps the function honest about round-tripping the input.
  return decoder.decode(encoder.encode(chunks.join(`${CRLF} `)));
}

function formatUtcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

function formatDateValue(parts: { year: number; month: number; day: number }): string {
  return `${String(parts.year).padStart(4, '0')}${String(parts.month).padStart(2, '0')}${String(parts.day).padStart(2, '0')}`;
}

function addDays(parts: { year: number; month: number; day: number }, days: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/**
 * Builds a single-event iCalendar document.
 *
 * Timed events are emitted as UTC instants (`...Z`), which avoids shipping a
 * VTIMEZONE block while staying unambiguous for every calendar client.
 * All-day events use `VALUE=DATE` with a non-inclusive DTEND, per RFC 5545.
 */
export function buildIcsCalendar(event: IcsEventInput, now: Date = new Date()): string {
  const day = zonedDateParts(event.eventDate, APP_TIME_ZONE);
  const start = event.startTime ? parseTimeString(event.startTime) : null;
  const end = event.endTime ? parseTimeString(event.endTime) : null;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(event.id)}@${event.uidDomain ?? 'schulkompass.nrw'}`,
    `DTSTAMP:${formatUtcStamp(now)}`,
  ];

  if (start) {
    const startInstant = zonedTimeToUtc({ ...day, hours: start.hours, minutes: start.minutes });
    lines.push(`DTSTART:${formatUtcStamp(startInstant)}`);

    // An end time earlier than the start time is treated as a same-day typo and
    // falls back to a two-hour default rather than emitting an invalid event.
    const endsAfterStart =
      end && (end.hours > start.hours || (end.hours === start.hours && end.minutes > start.minutes));
    const endInstant = endsAfterStart
      ? zonedTimeToUtc({ ...day, hours: end.hours, minutes: end.minutes })
      : new Date(startInstant.getTime() + 2 * 60 * 60 * 1000);
    lines.push(`DTEND:${formatUtcStamp(endInstant)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${formatDateValue(day)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDateValue(addDays(day, 1))}`);
  }

  lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.url) lines.push(`URL:${escapeIcsText(event.url)}`);
  lines.push('TRANSP:TRANSPARENT', 'END:VEVENT', 'END:VCALENDAR');

  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}

/** Safe, deterministic download file name for an event. */
export function icsFileName(title: string, eventDate: Date): string {
  const slug = title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const day = zonedDateParts(eventDate, APP_TIME_ZONE);
  return `${formatDateValue(day)}-${slug || 'termin'}.ics`;
}
