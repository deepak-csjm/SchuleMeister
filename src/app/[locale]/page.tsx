import { Info, SearchX } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { SchoolCard } from '@/components/school-card';
import { SchoolMap } from '@/components/school-map';
import { SearchForm } from '@/components/search-form';
import { searchSchools, listSchoolLanguages } from '@/server/schools';
import { type SearchQuery, searchQuerySchema } from '@/lib/validation';

interface HomePageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ params, searchParams }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('home');
  const tSearch = await getTranslations('search');
  const rawParams = await searchParams;

  // Unparseable parameters degrade to an unfiltered search rather than a 500.
  const parsed = searchQuerySchema.safeParse(rawParams);
  const query: SearchQuery = parsed.success ? parsed.data : searchQuerySchema.parse({});
  const hasQuery = Boolean(query.q || (query.lat !== undefined && query.lng !== undefined));

  const [{ schools, resolution, radiusKm }, languages] = await Promise.all([
    searchSchools(query),
    listSchoolLanguages(),
  ]);

  const markers = schools
    .filter((school) => school.latitude !== null && school.longitude !== null)
    .map((school) => ({
      id: school.id,
      name: school.name,
      latitude: school.latitude as number,
      longitude: school.longitude as number,
    }));

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </section>

      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <SearchForm languages={languages} />
      </Suspense>

      <p className="flex items-start gap-2 rounded-lg bg-accent/50 p-3 text-sm text-accent-foreground">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t('privacyNote')}
      </p>

      {resolution.unresolved ? (
        <p role="status" className="flex items-start gap-2 text-sm text-destructive">
          <SearchX aria-hidden className="mt-0.5 size-4 shrink-0" />
          {tSearch('unknownLocation')}
        </p>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold" role="status">
              {tSearch('resultCount', { count: schools.length })}
            </h2>
            {hasQuery && resolution.label && (
              <p className="text-sm text-muted-foreground">
                {tSearch('searchingNear', { location: resolution.label })}
                {resolution.center ? ` · ${tSearch('radiusValue', { km: radiusKm })}` : ''}
              </p>
            )}
          </div>

          {schools.length === 0 ? (
            <p className="text-muted-foreground">{tSearch('noResults')}</p>
          ) : (
            <>
              <SchoolMap
                markers={markers}
                center={resolution.center ?? undefined}
                zoom={resolution.center ? 13 : 11}
              />
              <ul className="grid gap-4 sm:grid-cols-2">
                {schools.map((school) => (
                  <li key={school.id} className="flex">
                    <SchoolCard school={school} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
