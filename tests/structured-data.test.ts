import { describe, expect, it } from 'vitest';
import { buildSchoolJsonLd } from '@/lib/structured-data';

const school = {
  id: 'school-1',
  officialCode: '123456',
  name: 'Grundschule Altstadt',
  type: 'GRUNDSCHULE',
  address: 'Musterstraße 1',
  postalCode: '40213',
  city: 'Düsseldorf',
  latitude: 51.2254,
  longitude: 6.7735,
  phone: '+49 211 1',
  email: 'a@example.org',
  website: 'https://example.org',
  description: 'Eine Schule',
};

const pageUrl = 'https://schulkompass.nrw/schools/school-1';

describe('buildSchoolJsonLd', () => {
  it('emits a graph with the school first', () => {
    const data = buildSchoolJsonLd(school, [], pageUrl);
    expect(data['@context']).toBe('https://schema.org');
    const graph = data['@graph'] as Record<string, unknown>[];
    expect(graph).toHaveLength(1);
    expect(graph[0]).toMatchObject({
      '@type': 'ElementarySchool',
      '@id': pageUrl,
      name: 'Grundschule Altstadt',
      telephone: '+49 211 1',
      email: 'a@example.org',
      sameAs: 'https://example.org',
      geo: { '@type': 'GeoCoordinates', latitude: 51.2254, longitude: 6.7735 },
    });
  });

  it('maps school types onto Schema.org types', () => {
    const typeOf = (type: string) =>
      (buildSchoolJsonLd({ ...school, type }, [], pageUrl)['@graph'] as Record<string, unknown>[])[0]![
        '@type'
      ];

    expect(typeOf('GRUNDSCHULE')).toBe('ElementarySchool');
    expect(typeOf('GYMNASIUM')).toBe('HighSchool');
    expect(typeOf('GESAMTSCHULE')).toBe('HighSchool');
    expect(typeOf('BERUFSKOLLEG')).toBe('School');
    expect(typeOf('FOERDERSCHULE')).toBe('School');
  });

  it('omits optional properties that are null instead of emitting nulls', () => {
    const data = buildSchoolJsonLd(
      { ...school, phone: null, email: null, website: null, description: null, latitude: null, longitude: null },
      [],
      pageUrl,
    );
    const node = (data['@graph'] as Record<string, unknown>[])[0]!;
    for (const key of ['telephone', 'email', 'sameAs', 'description', 'geo']) {
      expect(node).not.toHaveProperty(key);
    }
    // Required properties survive.
    expect(node).toHaveProperty('address');
  });

  it('converts a timed event to an absolute instant (CEST)', () => {
    const data = buildSchoolJsonLd(
      school,
      [
        {
          id: 'e1',
          title: 'Tag der offenen Tür',
          description: null,
          eventDate: new Date('2027-07-01T00:00:00Z'),
          startTime: '10:00',
          endTime: '14:00',
          location: 'Aula',
        },
      ],
      pageUrl,
    );

    const event = (data['@graph'] as Record<string, unknown>[])[1]!;
    expect(event['@type']).toBe('Event');
    expect(event.startDate).toBe('2027-07-01T08:00:00.000Z');
    expect(event.endDate).toBe('2027-07-01T12:00:00.000Z');
    expect(event.isAccessibleForFree).toBe(true);
  });

  it('converts a timed event in winter (CET)', () => {
    const data = buildSchoolJsonLd(
      school,
      [
        {
          id: 'e1',
          title: 'Informationsabend',
          description: null,
          eventDate: new Date('2027-01-15T00:00:00Z'),
          startTime: '18:30',
          endTime: null,
          location: null,
        },
      ],
      pageUrl,
    );

    const event = (data['@graph'] as Record<string, unknown>[])[1]!;
    expect(event.startDate).toBe('2027-01-15T17:30:00.000Z');
    expect(event).not.toHaveProperty('endDate');
  });

  it('uses a date-only value for all-day entries', () => {
    const data = buildSchoolJsonLd(
      school,
      [
        {
          id: 'e1',
          title: 'Anmeldezeitraum',
          description: null,
          eventDate: new Date('2027-02-10T00:00:00Z'),
          startTime: null,
          endTime: null,
          location: null,
        },
      ],
      pageUrl,
    );

    expect((data['@graph'] as Record<string, unknown>[])[1]!.startDate).toBe('2027-02-10');
  });

  it('stays safely serialisable when school text contains markup', () => {
    const data = buildSchoolJsonLd(
      { ...school, name: '</script><img src=x onerror=alert(1)>' },
      [],
      pageUrl,
    );
    const serialised = JSON.stringify(data).replace(/</g, '\\u003c');
    expect(serialised).not.toContain('</script>');
    expect(serialised).not.toContain('<img');
    // The text itself is preserved, just escaped.
    expect(JSON.parse(serialised.replace(/\\u003c/g, '<'))['@graph'][0].name).toBe(
      '</script><img src=x onerror=alert(1)>',
    );
  });
});
