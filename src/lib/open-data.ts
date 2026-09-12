import { z } from 'zod';

/**
 * Importer for the public NRW school directory (Schulverzeichnis / open.nrw).
 *
 * The published dataset is a delimited text file whose column names have
 * changed between releases, so the mapping from source columns to our schema is
 * data, not code: see `prisma/data/nrw-column-mapping.json`. Verify the mapping
 * against the current dataset before running an import in production.
 */

export type SchoolTypeKey =
  | 'GRUNDSCHULE'
  | 'HAUPTSCHULE'
  | 'REALSCHULE'
  | 'GYMNASIUM'
  | 'GESAMTSCHULE'
  | 'FOERDERSCHULE'
  | 'BERUFSKOLLEG';

/** Maps the German school-form labels and NRW form keys onto our enum. */
const SCHOOL_TYPE_LOOKUP: Record<string, SchoolTypeKey> = {
  grundschule: 'GRUNDSCHULE',
  gs: 'GRUNDSCHULE',
  hauptschule: 'HAUPTSCHULE',
  hs: 'HAUPTSCHULE',
  realschule: 'REALSCHULE',
  rs: 'REALSCHULE',
  gymnasium: 'GYMNASIUM',
  gy: 'GYMNASIUM',
  gesamtschule: 'GESAMTSCHULE',
  ge: 'GESAMTSCHULE',
  sekundarschule: 'GESAMTSCHULE',
  foerderschule: 'FOERDERSCHULE',
  'förderschule': 'FOERDERSCHULE',
  fs: 'FOERDERSCHULE',
  berufskolleg: 'BERUFSKOLLEG',
  bk: 'BERUFSKOLLEG',
};

export function normaliseSchoolType(raw: string | undefined | null): SchoolTypeKey | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, '');
  return SCHOOL_TYPE_LOOKUP[key] ?? null;
}

/**
 * Minimal RFC 4180 reader: handles quoted fields, escaped quotes and CRLF.
 * The NRW files are published as semicolon-separated UTF-8.
 */
export function parseDelimited(text: string, delimiter = ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  // Strip a UTF-8 BOM, which the published files contain.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((value) => value.trim().length > 0));
}

/** Column mapping: our field name -> list of accepted source column names. */
export const columnMappingSchema = z.record(z.string(), z.array(z.string()).min(1));
export type ColumnMapping = z.infer<typeof columnMappingSchema>;

export const schoolImportSchema = z.object({
  officialCode: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: z.enum([
    'GRUNDSCHULE',
    'HAUPTSCHULE',
    'REALSCHULE',
    'GYMNASIUM',
    'GESAMTSCHULE',
    'FOERDERSCHULE',
    'BERUFSKOLLEG',
  ]),
  address: z.string().trim().min(1),
  postalCode: z.string().trim().regex(/^\d{5}$/),
  city: z.string().trim().min(1),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  phone: z.string().trim().min(1).nullable(),
  email: z.string().trim().email().nullable(),
  website: z.string().trim().url().nullable(),
  hasOGS: z.boolean(),
});

export type SchoolImportRecord = z.infer<typeof schoolImportSchema>;

export interface ImportOutcome {
  records: SchoolImportRecord[];
  /** Rows that could not be mapped, with the reason, for operator review. */
  rejected: { row: number; reason: string }[];
}

const TRUTHY = new Set(['ja', 'j', 'true', '1', 'x', 'yes']);

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  // German exports use a comma as the decimal separator.
  const normalised = value.trim().replace(',', '.');
  if (normalised.length === 0) return null;
  const parsed = Number.parseFloat(normalised);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanUrl(value: string | undefined): string | null {
  if (!value || value.trim().length === 0) return null;
  const trimmed = value.trim();
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

/**
 * Maps parsed rows onto import records.
 * Invalid rows are rejected individually - one bad row must not abort an import
 * of thousands.
 */
export function mapSchoolRows(rows: string[][], mapping: ColumnMapping): ImportOutcome {
  const [header, ...dataRows] = rows;
  if (!header) return { records: [], rejected: [] };

  const normalisedHeader = header.map((column) => column.trim().toLowerCase());
  const indexFor = (field: string): number => {
    for (const candidate of mapping[field] ?? []) {
      const index = normalisedHeader.indexOf(candidate.trim().toLowerCase());
      if (index !== -1) return index;
    }
    return -1;
  };

  const indices = Object.fromEntries(
    Object.keys(mapping).map((field) => [field, indexFor(field)]),
  ) as Record<string, number>;

  const required = ['officialCode', 'name', 'type', 'address', 'postalCode', 'city'];
  const missing = required.filter((field) => (indices[field] ?? -1) === -1);
  if (missing.length > 0) {
    throw new Error(
      `Open-data import: the source is missing required columns for ${missing.join(', ')}. ` +
        `Update prisma/data/nrw-column-mapping.json. Found columns: ${normalisedHeader.join(', ')}`,
    );
  }

  const records: SchoolImportRecord[] = [];
  const rejected: ImportOutcome['rejected'] = [];
  const seen = new Set<string>();

  dataRows.forEach((row, offset) => {
    const rowNumber = offset + 2; // 1-based, plus the header line
    const read = (field: string): string | undefined => {
      const index = indices[field] ?? -1;
      return index === -1 ? undefined : row[index];
    };

    const type = normaliseSchoolType(read('type'));
    if (!type) {
      rejected.push({ row: rowNumber, reason: `unknown school type "${read('type') ?? ''}"` });
      return;
    }

    const candidate = {
      officialCode: (read('officialCode') ?? '').trim(),
      name: (read('name') ?? '').trim(),
      type,
      address: (read('address') ?? '').trim(),
      postalCode: (read('postalCode') ?? '').trim(),
      city: (read('city') ?? '').trim(),
      latitude: parseNumber(read('latitude')),
      longitude: parseNumber(read('longitude')),
      phone: (read('phone') ?? '').trim() || null,
      email: (read('email') ?? '').trim().toLowerCase() || null,
      website: cleanUrl(read('website')),
      hasOGS: TRUTHY.has((read('hasOGS') ?? '').trim().toLowerCase()),
    };

    const parsed = schoolImportSchema.safeParse(candidate);
    if (!parsed.success) {
      rejected.push({
        row: rowNumber,
        reason: parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; '),
      });
      return;
    }

    if (seen.has(parsed.data.officialCode)) {
      rejected.push({
        row: rowNumber,
        reason: `duplicate officialCode ${parsed.data.officialCode}`,
      });
      return;
    }

    seen.add(parsed.data.officialCode);
    records.push(parsed.data);
  });

  return { records, rejected };
}

/**
 * Derives postal-code centroids from imported schools.
 *
 * Used when no authoritative PLZ dataset is configured: the centroid of the
 * schools in a postal code is good enough to seed a radius search and is
 * derived from the same data, so it makes no independent geographic claim.
 */
export function derivePostalCentroids(
  records: Pick<SchoolImportRecord, 'postalCode' | 'city' | 'latitude' | 'longitude'>[],
): { code: string; city: string; latitude: number; longitude: number }[] {
  const groups = new Map<string, { city: string; lat: number[]; lng: number[] }>();

  for (const record of records) {
    if (record.latitude === null || record.longitude === null) continue;
    const group = groups.get(record.postalCode) ?? { city: record.city, lat: [], lng: [] };
    group.lat.push(record.latitude);
    group.lng.push(record.longitude);
    groups.set(record.postalCode, group);
  }

  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

  return [...groups.entries()]
    .map(([code, group]) => ({
      code,
      city: group.city,
      latitude: mean(group.lat),
      longitude: mean(group.lng),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}
