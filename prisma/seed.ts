/**
 * Database seed / open-data import.
 *
 * Two modes:
 *
 *  1. Open-data import (production path)
 *       SEED_SCHOOLS_URL=https://.../schulverzeichnis.csv npm run db:seed
 *       SEED_SCHOOLS_FILE=./downloads/schulverzeichnis.csv npm run db:seed
 *     Parses the public NRW school directory using the column mapping in
 *     prisma/data/nrw-column-mapping.json and upserts by `officialCode`.
 *
 *  2. Demo mode (default, local development)
 *     Loads prisma/data/demo-schools.json - clearly labelled synthetic records,
 *     plus demo staff accounts and a few upcoming events. Demo rows are only
 *     written when the database holds no non-demo school, so the seed can never
 *     pollute an imported dataset.
 *
 * The script is idempotent: running it twice produces the same database state.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient, type Prisma } from '@prisma/client';
import {
  columnMappingSchema,
  derivePostalCentroids,
  mapSchoolRows,
  parseDelimited,
  type SchoolImportRecord,
} from '../src/lib/open-data';

const prisma = new PrismaClient();
const dataDir = path.join(process.cwd(), 'prisma', 'data');

interface DemoSchool extends SchoolImportRecord {
  headmaster: string | null;
  languages: string[];
  facilities: string[];
  description: string | null;
  registrationNotes: string | null;
}

async function loadOpenDataSource(): Promise<string | null> {
  const url = process.env.SEED_SCHOOLS_URL;
  const file = process.env.SEED_SCHOOLS_FILE;

  if (file) {
    console.info(`[seed] reading school directory from file: ${file}`);
    return readFile(file, 'utf8');
  }

  if (url) {
    console.info(`[seed] downloading school directory from: ${url}`);
    const response = await fetch(url, { headers: { accept: 'text/csv,application/json' } });
    if (!response.ok) {
      throw new Error(`[seed] download failed: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }

  return null;
}

async function importFromOpenData(raw: string): Promise<number> {
  const mappingFile = await readFile(path.join(dataDir, 'nrw-column-mapping.json'), 'utf8');
  const parsedMapping = JSON.parse(mappingFile) as Record<string, unknown>;
  delete parsedMapping._comment;
  const mapping = columnMappingSchema.parse(parsedMapping);

  const delimiter = raw.includes(';') ? ';' : ',';
  const { records, rejected } = mapSchoolRows(parseDelimited(raw, delimiter), mapping);

  if (rejected.length > 0) {
    console.warn(`[seed] ${rejected.length} row(s) rejected; first 10:`);
    for (const entry of rejected.slice(0, 10)) {
      console.warn(`  row ${entry.row}: ${entry.reason}`);
    }
  }

  await upsertSchools(records);
  await upsertPostalCodes(derivePostalCentroids(records));

  console.info(`[seed] imported ${records.length} school(s) from open data`);
  return records.length;
}

async function upsertSchools(records: (SchoolImportRecord | DemoSchool)[]): Promise<void> {
  for (const record of records) {
    const extras = 'languages' in record ? record : null;
    const base = {
      name: record.name,
      type: record.type,
      address: record.address,
      postalCode: record.postalCode,
      city: record.city,
      latitude: record.latitude,
      longitude: record.longitude,
      phone: record.phone,
      email: record.email,
      website: record.website,
      hasOGS: record.hasOGS,
    } satisfies Prisma.SchoolUpdateInput;

    const optional = extras
      ? {
          headmaster: extras.headmaster,
          languages: extras.languages,
          facilities: extras.facilities,
          description: extras.description,
          registrationNotes: extras.registrationNotes,
        }
      : {};

    await prisma.school.upsert({
      where: { officialCode: record.officialCode },
      // An import must not overwrite text a school edited itself, so the
      // optional profile fields are only set when the source provides them.
      update: { ...base, ...optional },
      create: { officialCode: record.officialCode, ...base, ...optional },
    });
  }
}

async function upsertPostalCodes(
  entries: { code: string; city: string; latitude: number; longitude: number }[],
): Promise<void> {
  for (const entry of entries) {
    await prisma.postalCode.upsert({
      where: { code: entry.code },
      update: { city: entry.city, latitude: entry.latitude, longitude: entry.longitude },
      create: entry,
    });
  }
}

/** Date `days` from today at midnight Berlin time, as a UTC instant. */
function daysFromToday(days: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

async function seedDemoData(): Promise<void> {
  const nonDemoCount = await prisma.school.count({
    where: { officialCode: { not: { startsWith: 'DEMO-' } } },
  });

  if (nonDemoCount > 0) {
    console.info(
      `[seed] ${nonDemoCount} imported school(s) present - skipping demo data to avoid mixing datasets.`,
    );
    return;
  }

  const file = await readFile(path.join(dataDir, 'demo-schools.json'), 'utf8');
  const { schools } = JSON.parse(file) as { schools: DemoSchool[] };

  console.warn(
    '[seed] writing SYNTHETIC demo data (no SEED_SCHOOLS_URL / SEED_SCHOOLS_FILE set).\n' +
      '       These are not real schools - see docs/OPEN_DATA.md for the real import.',
  );

  await upsertSchools(schools);
  await upsertPostalCodes(derivePostalCentroids(schools));

  // Demo staff accounts: the email domain must also be listed in
  // ALLOWED_ADMIN_EMAIL_DOMAINS for a sign-in to succeed.
  const firstSchool = await prisma.school.findUnique({
    where: { officialCode: 'DEMO-100001' },
    select: { id: true },
  });
  const gymnasium = await prisma.school.findUnique({
    where: { officialCode: 'DEMO-200001' },
    select: { id: true },
  });

  if (firstSchool && gymnasium) {
    await prisma.user.upsert({
      where: { email: 'sekretariat@example.org' },
      update: { schoolId: firstSchool.id, role: 'SECRETARY', isActive: true },
      create: {
        email: 'sekretariat@example.org',
        role: 'SECRETARY',
        schoolId: firstSchool.id,
      },
    });

    await prisma.user.upsert({
      where: { email: 'admin@example.org' },
      update: { schoolId: gymnasium.id, role: 'SUPER_ADMIN', isActive: true },
      create: {
        email: 'admin@example.org',
        role: 'SUPER_ADMIN',
        schoolId: gymnasium.id,
      },
    });

    // Demo events, positioned relative to today so they are always upcoming.
    const demoEvents: (Prisma.EventCreateInput & { key: string })[] = [
      {
        key: 'demo-open-house-gs',
        title: 'Tag der offenen Tür',
        description:
          'Unterrichtsbesuche, Führungen durch das Schulgebäude und Gespräche mit der Schulleitung.',
        eventDate: daysFromToday(21),
        startTime: '09:00',
        endTime: '13:00',
        location: 'Haupteingang, Aula',
        eventType: 'OPEN_HOUSE',
        targetGrade: 'Vorschulkinder und Eltern',
        school: { connect: { id: firstSchool.id } },
      },
      {
        key: 'demo-info-evening-gym',
        title: 'Informationsabend zur Erprobungsstufe',
        description: 'Vorstellung der Schulformen, Sprachenfolge und Ganztagsangebote.',
        eventDate: daysFromToday(14),
        startTime: '18:30',
        endTime: '20:00',
        location: 'Aula',
        eventType: 'INFO_EVENING',
        targetGrade: 'Eltern der Klasse 4',
        school: { connect: { id: gymnasium.id } },
      },
      {
        key: 'demo-registration-gym',
        title: 'Anmeldezeitraum Klasse 5',
        description: 'Anmeldungen im Sekretariat, bitte Zeugnis und Anmeldeschein mitbringen.',
        eventDate: daysFromToday(45),
        startTime: null,
        endTime: null,
        location: 'Sekretariat',
        eventType: 'REGISTRATION',
        targetGrade: 'Klasse 4',
        school: { connect: { id: gymnasium.id } },
      },
    ];

    for (const { key, ...event } of demoEvents) {
      // Deterministic ids keep the seed idempotent without a natural key on Event.
      const id = `seed-${key}`;
      await prisma.event.upsert({
        where: { id },
        update: {
          title: event.title,
          description: event.description,
          eventDate: event.eventDate,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          eventType: event.eventType,
          targetGrade: event.targetGrade,
        },
        create: { id, ...event },
      });
    }
  }

  console.info(`[seed] demo data ready: ${schools.length} schools, 2 staff accounts, 3 events`);
}

async function main(): Promise<void> {
  const raw = await loadOpenDataSource();

  if (raw) {
    await importFromOpenData(raw);
  } else {
    await seedDemoData();
  }

  const [schools, postalCodes, events, users] = await Promise.all([
    prisma.school.count(),
    prisma.postalCode.count(),
    prisma.event.count(),
    prisma.user.count(),
  ]);

  console.info(
    `[seed] done - schools: ${schools}, postal codes: ${postalCodes}, events: ${events}, users: ${users}`,
  );
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
