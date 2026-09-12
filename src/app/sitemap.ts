import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { prisma } from '@/lib/prisma';
import { absoluteUrl } from '@/lib/site-url';

/**
 * Generated per request rather than at build time.
 *
 * With `revalidate` this route is prerendered during the build, which bakes in
 * the build machine's `SITE_URL`/`AUTH_URL` and silently publishes a sitemap
 * full of wrong-origin URLs. Crawlers fetch this a handful of times a day, so
 * one query per request is the cheaper mistake. It also keeps the build free of
 * any database dependency.
 */
export const dynamic = 'force-dynamic';

/** `{ de: ..., en: ... }` alternates for one path, as hreflang hints. */
function languageAlternates(path: string): Record<string, string> {
  return Object.fromEntries(
    routing.locales.map((locale) => [locale, absoluteUrl(path, locale)]),
  );
}

/**
 * Because of `revalidate`, this route is prerendered at build time. A build
 * machine without database access (CI, or a Vercel build without a reachable
 * DATABASE_URL) must not fail over a sitemap, so a failed query degrades to the
 * static entries and the next revalidation fills in the school pages.
 */
async function listSchoolsForSitemap(): Promise<{ id: string; updatedAt: Date }[]> {
  try {
    return await prisma.school.findMany({
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      // Well inside the 50,000-URL limit for a single sitemap even for all of
      // NRW; split with generateSitemaps() if the dataset ever outgrows this.
      take: 45_000,
    });
  } catch (error) {
    console.warn(
      '[sitemap] school pages omitted - the database was unreachable while generating the sitemap',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const schools = await listSchoolsForSitemap();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl('/'),
      lastModified: schools[0]?.updatedAt ?? new Date(),
      changeFrequency: 'daily',
      priority: 1,
      alternates: { languages: languageAlternates('/') },
    },
    ...(['/privacy', '/imprint', '/accessibility'] as const).map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
      alternates: { languages: languageAlternates(path) },
    })),
  ];

  const schoolEntries: MetadataRoute.Sitemap = schools.map((school) => ({
    url: absoluteUrl(`/schools/${school.id}`),
    lastModified: school.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
    alternates: { languages: languageAlternates(`/schools/${school.id}`) },
  }));

  return [...staticEntries, ...schoolEntries];
}
