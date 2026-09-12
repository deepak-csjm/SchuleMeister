import { describe, expect, it } from 'vitest';
import {
  eventSchema,
  fieldErrors,
  schoolProfileSchema,
  searchQuerySchema,
} from '@/lib/validation';

const validProfile = {
  name: 'Grundschule Altstadt',
  address: 'Musterstraße 1',
  postalCode: '40213',
  city: 'Düsseldorf',
  phone: '',
  email: '',
  website: '',
  headmaster: '',
  description: '',
  registrationNotes: '',
  hasOGS: false,
  languages: '',
  facilities: '',
};

describe('schoolProfileSchema', () => {
  it('accepts a minimal valid profile and nulls out empty optionals', () => {
    const result = schoolProfileSchema.parse(validProfile);
    expect(result.phone).toBeNull();
    expect(result.email).toBeNull();
    expect(result.website).toBeNull();
    expect(result.languages).toEqual([]);
  });

  it('splits and trims comma-separated lists', () => {
    const result = schoolProfileSchema.parse({
      ...validProfile,
      languages: ' Englisch , Französisch ,, Latein ',
      facilities: 'Mensa,Sporthalle',
    });
    expect(result.languages).toEqual(['Englisch', 'Französisch', 'Latein']);
    expect(result.facilities).toEqual(['Mensa', 'Sporthalle']);
  });

  it('rejects a postal code that is not five digits', () => {
    const result = schoolProfileSchema.safeParse({ ...validProfile, postalCode: '402' });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).postalCode).toBe('invalidPostalCode');
  });

  it('requires a name', () => {
    const result = schoolProfileSchema.safeParse({ ...validProfile, name: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).name).toBe('required');
  });

  it('rejects an invalid email address', () => {
    const result = schoolProfileSchema.safeParse({ ...validProfile, email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).email).toBe('invalidEmail');
  });

  it('requires an absolute http(s) website URL', () => {
    for (const website of ['example.org', 'javascript:alert(1)', 'ftp://example.org']) {
      const result = schoolProfileSchema.safeParse({ ...validProfile, website });
      expect(result.success, website).toBe(false);
      if (!result.success) expect(fieldErrors(result.error).website).toBe('invalidUrl');
    }

    expect(
      schoolProfileSchema.parse({ ...validProfile, website: 'https://example.org/schule' })
        .website,
    ).toBe('https://example.org/schule');
  });

  it('caps oversized text', () => {
    const result = schoolProfileSchema.safeParse({
      ...validProfile,
      description: 'x'.repeat(5000),
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).description).toBe('tooLong');
  });
});

const validEvent = {
  title: 'Tag der offenen Tür',
  description: '',
  eventDate: '2027-01-15',
  startTime: '09:00',
  endTime: '13:00',
  location: 'Aula',
  eventType: 'OPEN_HOUSE' as const,
  targetGrade: 'Klasse 4',
  isPublished: true,
};

describe('eventSchema', () => {
  it('accepts a valid event', () => {
    expect(eventSchema.parse(validEvent).title).toBe('Tag der offenen Tür');
  });

  it('accepts an all-day event without times', () => {
    const result = eventSchema.parse({ ...validEvent, startTime: '', endTime: '' });
    expect(result.startTime).toBeNull();
    expect(result.endTime).toBeNull();
  });

  it('rejects an end time before the start time', () => {
    const result = eventSchema.safeParse({ ...validEvent, startTime: '14:00', endTime: '09:00' });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).endTime).toBe('endBeforeStart');
  });

  it('rejects an end time equal to the start time', () => {
    const result = eventSchema.safeParse({ ...validEvent, startTime: '09:00', endTime: '09:00' });
    expect(result.success).toBe(false);
  });

  it('rejects an end time without a start time', () => {
    const result = eventSchema.safeParse({ ...validEvent, startTime: '', endTime: '13:00' });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).startTime).toBe('required');
  });

  it('rejects malformed times and dates', () => {
    expect(eventSchema.safeParse({ ...validEvent, startTime: '9:00' }).success).toBe(false);
    expect(eventSchema.safeParse({ ...validEvent, eventDate: '15.01.2027' }).success).toBe(false);
  });

  it('rejects an unknown event type', () => {
    expect(eventSchema.safeParse({ ...validEvent, eventType: 'PARTY' }).success).toBe(false);
  });
});

describe('searchQuerySchema', () => {
  it('defaults the boolean filters to false', () => {
    const result = searchQuerySchema.parse({});
    expect(result.ogs).toBe(false);
    expect(result.openHouse).toBe(false);
  });

  it('coerces numeric query parameters', () => {
    const result = searchQuerySchema.parse({ lat: '51.22', lng: '6.77', radius: '10' });
    expect(result).toMatchObject({ lat: 51.22, lng: 6.77, radius: 10 });
  });

  it('rejects out-of-range coordinates and radii', () => {
    expect(searchQuerySchema.safeParse({ lat: '91' }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ lng: '181' }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ radius: '1000' }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ radius: '0.1' }).success).toBe(false);
  });

  it('rejects an unknown school type', () => {
    expect(searchQuerySchema.safeParse({ type: 'UNIVERSITY' }).success).toBe(false);
  });

  it('caps the result limit', () => {
    expect(searchQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
    expect(searchQuerySchema.parse({ limit: '25' }).limit).toBe(25);
  });
});
