/** All school dates are published in German local time. */
export const APP_TIME_ZONE = 'Europe/Berlin';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeString(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function parseTimeString(value: string): { hours: number; minutes: number } | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

/**
 * Offset of `timeZone` at a given instant, in milliseconds.
 */
function timeZoneOffsetMs(instantMs: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(new Date(instantMs));
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type);
    return part ? Number(part.value) : 0;
  };

  // `hour12: false` can yield hour 24 for midnight in some ICU versions.
  const hour = read('hour') % 24;
  const asIfUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    hour,
    read('minute'),
    read('second'),
  );

  return asIfUtc - instantMs;
}

/**
 * Converts a wall-clock time in `timeZone` to the corresponding UTC instant.
 *
 * Two iterations are enough to converge for every real-world DST rule; the
 * ambiguous hour of a backward DST transition resolves to the first (summer
 * time) occurrence, which matches how calendar clients behave.
 */
export function zonedTimeToUtc(
  parts: { year: number; month: number; day: number; hours?: number; minutes?: number },
  timeZone: string = APP_TIME_ZONE,
): Date {
  const naive = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hours ?? 0,
    parts.minutes ?? 0,
    0,
  );

  let instant = naive - timeZoneOffsetMs(naive, timeZone);
  instant = naive - timeZoneOffsetMs(instant, timeZone);
  return new Date(instant);
}

/** Calendar date parts of an instant as seen in `timeZone`. */
export function zonedDateParts(
  date: Date,
  timeZone: string = APP_TIME_ZONE,
): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [year, month, day] = formatter.format(date).split('-').map(Number);
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

/** `YYYY-MM-DD` in the app time zone - the value shape used by `<input type="date">`. */
export function toDateInputValue(date: Date, timeZone: string = APP_TIME_ZONE): string {
  const { year, month, day } = zonedDateParts(date, timeZone);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Parses `YYYY-MM-DD` into the UTC instant of that day's midnight in Berlin. */
export function fromDateInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = zonedTimeToUtc({ year, month, day });
  // Reject calendar-invalid input such as 2026-02-31, which would roll over.
  const parts = zonedDateParts(date);
  if (parts.year !== year || parts.month !== month || parts.day !== day) return null;
  return date;
}

/** Start of today in the app time zone, useful for "upcoming events" queries. */
export function startOfTodayInAppZone(now: Date = new Date()): Date {
  return zonedTimeToUtc(zonedDateParts(now, APP_TIME_ZONE));
}
