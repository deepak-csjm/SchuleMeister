import { type NextRequest, NextResponse } from 'next/server';
import { searchQuerySchema } from '@/lib/validation';
import { searchSchools } from '@/server/schools';

export const runtime = 'nodejs';
// Search results depend on the query string and on data that schools edit, so
// they are computed per request but may be cached briefly by the CDN.
export const dynamic = 'force-dynamic';

/**
 * Public, unauthenticated school search.
 *
 * Deliberately anonymous: no cookies are read or set and nothing about the
 * caller is logged.
 */
export async function GET(request: NextRequest) {
  const parsed = searchQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_query', issues: parsed.error.issues.map((issue) => issue.path.join('.')) },
      { status: 400 },
    );
  }

  const { schools, resolution, radiusKm } = await searchSchools(parsed.data);

  return NextResponse.json(
    {
      radiusKm,
      center: resolution.center,
      locationLabel: resolution.label,
      unresolvedLocation: resolution.unresolved,
      count: schools.length,
      schools: schools.map((school) => ({
        id: school.id,
        officialCode: school.officialCode,
        name: school.name,
        type: school.type,
        address: school.address,
        postalCode: school.postalCode,
        city: school.city,
        latitude: school.latitude,
        longitude: school.longitude,
        phone: school.phone,
        email: school.email,
        website: school.website,
        hasOGS: school.hasOGS,
        languages: school.languages,
        distanceKm: school.distanceKm === null ? null : Number(school.distanceKm.toFixed(2)),
        nextEvent: school.nextEvent && {
          id: school.nextEvent.id,
          title: school.nextEvent.title,
          eventDate: school.nextEvent.eventDate.toISOString(),
          eventType: school.nextEvent.eventType,
        },
      })),
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
      },
    },
  );
}
