import { describe, expect, it } from 'vitest';
import {
  fromDateInputValue,
  isValidTimeString,
  parseTimeString,
  startOfTodayInAppZone,
  toDateInputValue,
  zonedDateParts,
  zonedTimeToUtc,
} from '@/lib/datetime';

describe('isValidTimeString / parseTimeString', () => {
  it.each(['00:00', '09:30', '23:59'])('accepts %s', (value) => {
    expect(isValidTimeString(value)).toBe(true);
  });

  it.each(['24:00', '9:30', '23:60', '', 'ab:cd', '09:30:00'])('rejects %s', (value) => {
    expect(isValidTimeString(value)).toBe(false);
    expect(parseTimeString(value)).toBeNull();
  });

  it('parses the components', () => {
    expect(parseTimeString('18:45')).toEqual({ hours: 18, minutes: 45 });
  });
});

describe('zonedTimeToUtc', () => {
  it('applies CET (UTC+1) in winter', () => {
    const instant = zonedTimeToUtc({ year: 2027, month: 1, day: 15, hours: 9, minutes: 0 });
    expect(instant.toISOString()).toBe('2027-01-15T08:00:00.000Z');
  });

  it('applies CEST (UTC+2) in summer', () => {
    const instant = zonedTimeToUtc({ year: 2027, month: 7, day: 15, hours: 9, minutes: 0 });
    expect(instant.toISOString()).toBe('2027-07-15T07:00:00.000Z');
  });

  it('handles the day right after the spring DST switch', () => {
    // Germany switches on the last Sunday of March (2027-03-28).
    const instant = zonedTimeToUtc({ year: 2027, month: 3, day: 29, hours: 8, minutes: 30 });
    expect(instant.toISOString()).toBe('2027-03-29T06:30:00.000Z');
  });

  it('handles the day right before the autumn DST switch', () => {
    const instant = zonedTimeToUtc({ year: 2027, month: 10, day: 30, hours: 8, minutes: 30 });
    expect(instant.toISOString()).toBe('2027-10-30T06:30:00.000Z');
  });

  it('defaults to midnight local time', () => {
    expect(zonedTimeToUtc({ year: 2027, month: 6, day: 1 }).toISOString()).toBe(
      '2027-05-31T22:00:00.000Z',
    );
  });
});

describe('zonedDateParts', () => {
  it('reports the Berlin calendar day, not the UTC one', () => {
    // 22:30 UTC in summer is already the next day in Berlin.
    expect(zonedDateParts(new Date('2027-06-30T22:30:00Z'))).toEqual({
      year: 2027,
      month: 7,
      day: 1,
    });
  });
});

describe('toDateInputValue / fromDateInputValue', () => {
  it('round-trips a date', () => {
    const value = '2027-02-28';
    const parsed = fromDateInputValue(value);
    expect(parsed).not.toBeNull();
    expect(toDateInputValue(parsed!)).toBe(value);
  });

  it('round-trips across the summer/winter boundary', () => {
    for (const value of ['2027-03-27', '2027-03-28', '2027-03-29', '2027-10-31']) {
      expect(toDateInputValue(fromDateInputValue(value)!)).toBe(value);
    }
  });

  it.each(['2027-02-31', '2027-13-01', '2027-00-10', '27-01-01', '', 'not-a-date'])(
    'rejects the invalid date %s',
    (value) => {
      expect(fromDateInputValue(value)).toBeNull();
    },
  );
});

describe('startOfTodayInAppZone', () => {
  it('returns midnight Berlin time for the given instant', () => {
    const result = startOfTodayInAppZone(new Date('2027-07-15T21:15:00Z'));
    // 21:15 UTC on 15 July is 23:15 in Berlin, so "today" is still 15 July.
    expect(result.toISOString()).toBe('2027-07-14T22:00:00.000Z');
    expect(zonedDateParts(result)).toEqual({ year: 2027, month: 7, day: 15 });
  });
});
