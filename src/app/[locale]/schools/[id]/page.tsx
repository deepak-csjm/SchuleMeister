import {
  ArrowLeft,
  Building2,
  Globe,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from 'lucide-react';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EventList } from '@/components/event-list';
import { JsonLd } from '@/components/json-ld';
import { SchoolMap } from '@/components/school-map';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { startOfTodayInAppZone } from '@/lib/datetime';
import { routing } from '@/i18n/routing';
import { absoluteUrl } from '@/lib/site-url';
import { buildSchoolJsonLd } from '@/lib/structured-data';
import { getSchoolDetail } from '@/server/schools';

interface SchoolPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: SchoolPageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const school = await getSchoolDetail(id);
  if (!school) return {};

  const path = `/schools/${school.id}`;
  const description = `${school.name}, ${school.address}, ${school.postalCode} ${school.city}`;

  return {
    title: school.name,
    description,
    alternates: {
      canonical: absoluteUrl(path, locale),
      languages: Object.fromEntries(
        routing.locales.map((candidate) => [candidate, absoluteUrl(path, candidate)]),
      ),
    },
    openGraph: {
      type: 'profile',
      title: school.name,
      description,
      url: absoluteUrl(path, locale),
      locale,
    },
  };
}

export default async function SchoolDetailPage({ params }: SchoolPageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const school = await getSchoolDetail(id);
  if (!school) notFound();

  const t = await getTranslations('school');
  const tType = await getTranslations('schoolType');
  const tEvents = await getTranslations('events');
  const format = await getFormatter();

  const today = startOfTodayInAppZone();
  const upcoming = school.events.filter((event) => event.eventDate >= today);
  const past = school.events
    .filter((event) => event.eventDate < today)
    .sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime())
    .slice(0, 5);

  const hasCoordinates = school.latitude !== null && school.longitude !== null;

  const jsonLd = buildSchoolJsonLd(
    school,
    // Only upcoming dates are worth exposing as events to a search engine.
    upcoming,
    absoluteUrl(`/schools/${school.id}`, locale),
  );

  return (
    <article className="space-y-6">
      <JsonLd data={jsonLd} />
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
        {t('backToSearch')}
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{tType(school.type)}</Badge>
          <Badge variant={school.hasOGS ? 'success' : 'muted'}>
            {school.hasOGS ? t('ogsAvailable') : t('ogsUnavailable')}
          </Badge>
          <Badge variant="outline">
            {t('officialCode')} {school.officialCode}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{school.name}</h1>
        <p className="flex items-start gap-2 text-muted-foreground">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
          {school.address}, {school.postalCode} {school.city}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          {school.description && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">{t('about')}</h2>
              <p className="whitespace-pre-line text-muted-foreground">{school.description}</p>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t('events')}</h2>
            {upcoming.length > 0 && (
              <>
                <h3 className="text-sm font-medium text-muted-foreground">
                  {tEvents('upcoming')}
                </h3>
                <EventList events={upcoming} />
              </>
            )}
            {upcoming.length === 0 && <EventList events={[]} />}
            {past.length > 0 && (
              <details className="rounded-lg border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  {tEvents('past')}
                </summary>
                <div className="mt-3">
                  <EventList events={past} />
                </div>
              </details>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('contact')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {school.headmaster && (
                <p className="flex items-start gap-2">
                  <UserRound aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="text-muted-foreground">{t('headmaster')}: </span>
                    {school.headmaster}
                  </span>
                </p>
              )}
              {school.phone && (
                <p className="flex items-start gap-2">
                  <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <a href={`tel:${school.phone.replace(/\s+/g, '')}`} className="hover:underline">
                    {school.phone}
                  </a>
                </p>
              )}
              {school.email && (
                <p className="flex items-start gap-2">
                  <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <a href={`mailto:${school.email}`} className="break-all hover:underline">
                    {school.email}
                  </a>
                </p>
              )}
              {school.website && (
                <p className="flex items-start gap-2">
                  <Globe aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <a
                    href={school.website}
                    target="_blank"
                    rel="noopener noreferrer external"
                    className="break-all hover:underline"
                  >
                    {school.website}
                  </a>
                </p>
              )}
              <p className="pt-1 text-xs text-muted-foreground">
                {t('lastUpdated', {
                  date: format.dateTime(school.updatedAt, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  }),
                })}
              </p>
            </CardContent>
          </Card>

          {school.languages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <GraduationCap aria-hidden className="size-4 text-muted-foreground" />
                  {t('languages')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {school.languages.map((language) => (
                  <Badge key={language} variant="outline">
                    {language}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          {school.facilities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 aria-hidden className="size-4 text-muted-foreground" />
                  {t('facilities')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {school.facilities.map((facility) => (
                  <Badge key={facility} variant="secondary">
                    {facility}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          {school.registrationNotes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('registrationNotes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {school.registrationNotes}
                </p>
              </CardContent>
            </Card>
          )}

          {hasCoordinates && (
            <SchoolMap
              markers={[
                {
                  id: school.id,
                  name: school.name,
                  latitude: school.latitude as number,
                  longitude: school.longitude as number,
                },
              ]}
              center={{
                latitude: school.latitude as number,
                longitude: school.longitude as number,
              }}
              zoom={15}
            />
          )}
        </aside>
      </div>
    </article>
  );
}
