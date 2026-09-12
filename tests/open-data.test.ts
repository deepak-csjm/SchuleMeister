import { describe, expect, it } from 'vitest';
import {
  type ColumnMapping,
  derivePostalCentroids,
  mapSchoolRows,
  normaliseSchoolType,
  parseDelimited,
} from '@/lib/open-data';

const mapping: ColumnMapping = {
  officialCode: ['Schulnummer'],
  name: ['Schulname'],
  type: ['Schulform'],
  address: ['Strasse'],
  postalCode: ['PLZ'],
  city: ['Ort'],
  latitude: ['Breitengrad'],
  longitude: ['Laengengrad'],
  phone: ['Telefon'],
  email: ['E-Mail'],
  website: ['Internet'],
  hasOGS: ['OGS'],
};

const header =
  'Schulnummer;Schulname;Schulform;Strasse;PLZ;Ort;Breitengrad;Laengengrad;Telefon;E-Mail;Internet;OGS';

describe('parseDelimited', () => {
  it('splits semicolon-separated rows', () => {
    expect(parseDelimited('a;b;c\nd;e;f')).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  it('handles quoted fields containing the delimiter and newlines', () => {
    expect(parseDelimited('a;"b;c";d\n')).toEqual([['a', 'b;c', 'd']]);
    expect(parseDelimited('a;"line1\nline2";c')).toEqual([['a', 'line1\nline2', 'c']]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseDelimited('a;"say ""hi""";c')).toEqual([['a', 'say "hi"', 'c']]);
  });

  it('handles CRLF line endings and a UTF-8 BOM', () => {
    expect(parseDelimited('﻿a;b\r\nc;d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('drops blank lines', () => {
    expect(parseDelimited('a;b\n\n;\nc;d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('supports a comma delimiter', () => {
    expect(parseDelimited('a,b\nc,d', ',')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('normaliseSchoolType', () => {
  it('maps German labels and short keys', () => {
    expect(normaliseSchoolType('Grundschule')).toBe('GRUNDSCHULE');
    expect(normaliseSchoolType(' GY ')).toBe('GYMNASIUM');
    expect(normaliseSchoolType('Förderschule')).toBe('FOERDERSCHULE');
    expect(normaliseSchoolType('Sekundarschule')).toBe('GESAMTSCHULE');
  });

  it('returns null for unknown or missing values', () => {
    expect(normaliseSchoolType('Hochschule')).toBeNull();
    expect(normaliseSchoolType('')).toBeNull();
    expect(normaliseSchoolType(undefined)).toBeNull();
  });
});

describe('mapSchoolRows', () => {
  it('maps a well-formed row, including German decimal commas', () => {
    const csv = [
      header,
      '123456;Grundschule Nord;Grundschule;Musterstr. 1;40210;Düsseldorf;51,2217;6,7899;0211 1;a@example.org;www.example.org;Ja',
    ].join('\n');

    const { records, rejected } = mapSchoolRows(parseDelimited(csv), mapping);

    expect(rejected).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      officialCode: '123456',
      name: 'Grundschule Nord',
      type: 'GRUNDSCHULE',
      postalCode: '40210',
      latitude: 51.2217,
      longitude: 6.7899,
      email: 'a@example.org',
      website: 'https://www.example.org/',
      hasOGS: true,
    });
  });

  it('matches column names case-insensitively', () => {
    const csv = [header.toUpperCase(), '1;A;GS;Str 1;40210;Düsseldorf;;;;;;'].join('\n');
    const { records } = mapSchoolRows(parseDelimited(csv), mapping);
    expect(records).toHaveLength(1);
    expect(records[0]?.latitude).toBeNull();
  });

  it('rejects rows with an unknown school type but keeps the rest', () => {
    const csv = [
      header,
      '1;Hochschule X;Hochschule;Str 1;40210;Düsseldorf;;;;;;',
      '2;Gymnasium Y;Gymnasium;Str 2;40210;Düsseldorf;;;;;;',
    ].join('\n');

    const { records, rejected } = mapSchoolRows(parseDelimited(csv), mapping);
    expect(records.map((record) => record.officialCode)).toEqual(['2']);
    expect(rejected).toEqual([{ row: 2, reason: 'unknown school type "Hochschule"' }]);
  });

  it('rejects an invalid postal code', () => {
    const csv = [header, '1;A;Grundschule;Str 1;402;Düsseldorf;;;;;;'].join('\n');
    const { records, rejected } = mapSchoolRows(parseDelimited(csv), mapping);
    expect(records).toHaveLength(0);
    expect(rejected[0]?.reason).toContain('postalCode');
  });

  it('drops an unusable email or website instead of the whole row', () => {
    const csv = [header, '1;A;Grundschule;Str 1;40210;Düsseldorf;;;;not-an-email;h t t p;'].join(
      '\n',
    );
    const { records, rejected } = mapSchoolRows(parseDelimited(csv), mapping);
    // An invalid email fails validation for that row, which is intentional:
    // publishing a wrong contact address is worse than publishing none.
    expect(records).toHaveLength(0);
    expect(rejected[0]?.reason).toContain('email');
  });

  it('keeps the first of two rows with the same school number', () => {
    const csv = [
      header,
      '1;A;Grundschule;Str 1;40210;Düsseldorf;;;;;;',
      '1;A duplicate;Grundschule;Str 2;40210;Düsseldorf;;;;;;',
    ].join('\n');

    const { records, rejected } = mapSchoolRows(parseDelimited(csv), mapping);
    expect(records).toHaveLength(1);
    expect(records[0]?.name).toBe('A');
    expect(rejected[0]?.reason).toContain('duplicate');
  });

  it('reads OGS truthiness from several spellings', () => {
    const csv = [
      header,
      '1;A;Grundschule;Str 1;40210;Düsseldorf;;;;;;JA',
      '2;B;Grundschule;Str 1;40210;Düsseldorf;;;;;;x',
      '3;C;Grundschule;Str 1;40210;Düsseldorf;;;;;;nein',
      '4;D;Grundschule;Str 1;40210;Düsseldorf;;;;;;',
    ].join('\n');

    const { records } = mapSchoolRows(parseDelimited(csv), mapping);
    expect(records.map((record) => record.hasOGS)).toEqual([true, true, false, false]);
  });

  it('fails loudly when a required column is missing', () => {
    const csv = ['Schulname;PLZ', 'A;40210'].join('\n');
    expect(() => mapSchoolRows(parseDelimited(csv), mapping)).toThrowError(
      /missing required columns/,
    );
  });

  it('returns nothing for empty input', () => {
    expect(mapSchoolRows([], mapping)).toEqual({ records: [], rejected: [] });
  });
});

describe('derivePostalCentroids', () => {
  it('averages the coordinates per postal code', () => {
    const centroids = derivePostalCentroids([
      { postalCode: '40210', city: 'Düsseldorf', latitude: 51.2, longitude: 6.8 },
      { postalCode: '40210', city: 'Düsseldorf', latitude: 51.4, longitude: 6.6 },
      { postalCode: '41460', city: 'Neuss', latitude: 51.2, longitude: 6.7 },
    ]);

    expect(centroids.map((entry) => entry.code)).toEqual(['40210', '41460']);
    expect(centroids[0]?.city).toBe('Düsseldorf');
    expect(centroids[0]?.latitude).toBeCloseTo(51.3, 10);
    expect(centroids[0]?.longitude).toBeCloseTo(6.7, 10);
    expect(centroids[1]).toMatchObject({ city: 'Neuss', latitude: 51.2, longitude: 6.7 });
  });

  it('ignores records without coordinates', () => {
    expect(
      derivePostalCentroids([
        { postalCode: '40210', city: 'Düsseldorf', latitude: null, longitude: null },
      ]),
    ).toEqual([]);
  });
});
