import type { Prisma, SchoolType } from '@prisma/client';
import { startOfTodayInAppZone } from '@/lib/datetime';
import {
  boundingBox,
  type Coordinates,
  DEFAULT_RADIUS_KM,
  haversineDistanceKm,
  isGermanPostalCode,
} from '@/lib/geo';
import { prisma } from '@/lib/prisma';
import type { SearchQuery } from '@/lib/validation';

/** Fields of a school that the public list view needs. */
const listSelect = {
  id: true,
  officialCode: true,
  name: true,
  type: true,
  address: true,
  city: true,
  postalCode: true,
  latitude: true,
  longitude: true,
  phone: true,
  email: true,
  website: true,
  hasOGS: true,
  languages: true,
  updatedAt: true,
} satisfies Prisma.SchoolSelect;

export type SchoolListItem = Prisma.SchoolGetPayload<{ select: typeof listSelect }> & {
  distanceKm: number | null;
  nextEvent: { id: string; title: string; eventDate: Date; eventType: string } | null;
};

export interface SearchResolution {
  /** Centre used for the radius search, if the query resolved to coordinates. */
  center: Coordinates | null;
  /** Human-readable description of what was searched, e.g. "40210 Düsseldorf". */
  label: string | null;
  /** True when the input looked like a location but could not be resolved. */
  unresolved: boolean;
}

export interface SearchResult {
  schools: SchoolListItem[];
  resolution: SearchResolution;
  radiusKm: number;
}

/**
 * Turns a free-text location (PLZ or city) or explicit coordinates into a
 * search centre. Postal codes are resolved from the local `PostalCode` table -
 * no third-party geocoding request is made (privacy by design).
 */
export async function resolveSearchLocation(query: SearchQuery): Promise<SearchResolution> {
  if (typeof query.lat === 'number' && typeof query.lng === 'number') {
    return {
      center: { latitude: query.lat, longitude: query.lng },
      label: null,
      unresolved: false,
    };
  }

  const term = query.q?.trim();
  if (!term) return { center: null, label: null, unresolved: false };

  if (isGermanPostalCode(term)) {
    const postalCode = await prisma.postalCode.findUnique({ where: { code: term } });
    if (postalCode) {
      return {
        center: { latitude: postalCode.latitude, longitude: postalCode.longitude },
        label: `${postalCode.code} ${postalCode.city}`,
        unresolved: false,
      };
    }
    // Unknown PLZ: fall back to an exact match on the school's postal code so
    // the search still works before the full PLZ dataset is imported.
    const schoolCount = await prisma.school.count({ where: { postalCode: term } });
    return { center: null, label: term, unresolved: schoolCount === 0 };
  }

  // City search: use the mean of the city's known postal-code centroids.
  const centroids = await prisma.postalCode.findMany({
    where: { city: { equals: term, mode: 'insensitive' } },
    select: { latitude: true, longitude: true, city: true },
  });

  if (centroids.length > 0) {
    const latitude =
      centroids.reduce((sum, item) => sum + item.latitude, 0) / centroids.length;
    const longitude =
      centroids.reduce((sum, item) => sum + item.longitude, 0) / centroids.length;
    return {
      center: { latitude, longitude },
      label: centroids[0]?.city ?? term,
      unresolved: false,
    };
  }

  const schoolCount = await prisma.school.count({
    where: { city: { equals: term, mode: 'insensitive' } },
  });
  return { center: null, label: term, unresolved: schoolCount === 0 };
}

/**
 * Radius search with a bounding-box pre-filter in PostgreSQL and an exact
 * haversine refinement in the application.
 *
 * The bounding box uses the `(latitude, longitude)` index, so only the handful
 * of rows inside the box are transferred. At national scale the refinement step
 * should move into PostGIS (`ST_DWithin`) - see docs/ARCHITECTURE.md.
 */
export async function searchSchools(query: SearchQuery): Promise<SearchResult> {
  const radiusKm = query.radius ?? DEFAULT_RADIUS_KM;
  const resolution = await resolveSearchLocation(query);
  const limit = query.limit ?? 50;
  const today = startOfTodayInAppZone();

  const where: Prisma.SchoolWhereInput = {};
  if (query.type) where.type = query.type as SchoolType;
  if (query.ogs) where.hasOGS = true;
  if (query.language) where.languages = { has: query.language };
  if (query.openHouse) {
    where.events = {
      some: {
        isPublished: true,
        eventType: 'OPEN_HOUSE',
        eventDate: { gte: today },
      },
    };
  }

  if (resolution.center) {
    const box = boundingBox(resolution.center, radiusKm);
    where.latitude = { gte: box.minLatitude, lte: box.maxLatitude };
    where.longitude = { gte: box.minLongitude, lte: box.maxLongitude };
  } else if (resolution.label && query.q) {
    const term = query.q.trim();
    where.OR = isGermanPostalCode(term)
      ? [{ postalCode: term }]
      : [{ city: { equals: term, mode: 'insensitive' } }];
  }

  const rows = await prisma.school.findMany({
    where,
    select: {
      ...listSelect,
      events: {
        where: { isPublished: true, eventDate: { gte: today } },
        orderBy: { eventDate: 'asc' },
        take: 1,
        select: { id: true, title: true, eventDate: true, eventType: true },
      },
    },
    orderBy: { name: 'asc' },
    // The bounding box can contain more rows than the circle; fetch a margin so
    // the post-filter does not truncate valid results.
    take: resolution.center ? Math.min(limit * 4, 400) : limit,
  });

  const center = resolution.center;
  const schools: SchoolListItem[] = rows
    .map(({ events, ...school }) => ({
      ...school,
      nextEvent: events[0] ?? null,
      distanceKm:
        center && school.latitude !== null && school.longitude !== null
          ? haversineDistanceKm(center, {
              latitude: school.latitude,
              longitude: school.longitude,
            })
          : null,
    }))
    .filter((school) => (center ? school.distanceKm !== null && school.distanceKm <= radiusKm : true))
    .sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      return a.name.localeCompare(b.name, 'de');
    })
    .slice(0, limit);

  return { schools, resolution, radiusKm };
}

/** Full public detail view of one school, including its published events. */
export async function getSchoolDetail(id: string) {
  return prisma.school.findUnique({
    where: { id },
    include: {
      events: {
        where: { isPublished: true },
        orderBy: { eventDate: 'asc' },
      },
    },
  });
}

/** Distinct language values across all schools, for the filter dropdown. */
export async function listSchoolLanguages(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ language: string }[]>`
    SELECT DISTINCT unnest(languages) AS language
    FROM "School"
    ORDER BY language ASC
  `;
  return rows.map((row) => row.language);
}
