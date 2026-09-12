import { CalendarDays, MapPin, Navigation } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { formatDistanceKm } from '@/lib/geo';
import type { SchoolListItem } from '@/server/schools';

export function SchoolCard({ school }: { school: SchoolListItem }) {
  const t = useTranslations('school');
  const tType = useTranslations('schoolType');
  const tEventType = useTranslations('eventType');
  const format = useFormatter();

  return (
    <Card className="flex w-full flex-col">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{tType(school.type)}</Badge>
          {school.hasOGS && <Badge variant="success">{t('ogsAvailable')}</Badge>}
          {school.distanceKm !== null && (
            <Badge variant="muted">
              <Navigation aria-hidden className="size-3" />
              {t('distance', { km: formatDistanceKm(school.distanceKm) })}
            </Badge>
          )}
        </div>
        <CardTitle>
          <Link href={`/schools/${school.id}`} className="hover:underline">
            {school.name}
          </Link>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 space-y-2 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">
            {school.address}, {school.postalCode} {school.city}
          </span>
        </p>

        {school.nextEvent && (
          <p className="flex items-start gap-2 text-foreground">
            <CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="min-w-0 break-words">
              <span className="font-medium">
                {tEventType(school.nextEvent.eventType as 'OPEN_HOUSE')}
              </span>
              {' · '}
              {format.dateTime(school.nextEvent.eventDate, {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </p>
        )}

        {school.languages.length > 0 && (
          <p className="flex flex-wrap gap-1.5">
            {school.languages.map((language) => (
              <Badge key={language} variant="outline">
                {language}
              </Badge>
            ))}
          </p>
        )}
      </CardContent>

      <CardFooter>
        {/* The label must be allowed to wrap: at 200% text size a nowrap
            button is wider than its card. */}
        <Button asChild variant="outline" size="sm" className="h-auto whitespace-normal py-2">
          {/*
            Every card would otherwise contribute an identically named link, so
            a screen reader's link list reads "view details" a dozen times with
            no way to tell the schools apart (WCAG 2.4.4). The visible text stays
            the first part of the accessible name, which keeps voice control
            working (WCAG 2.5.3 Label in Name).
          */}
          <Link
            href={`/schools/${school.id}`}
            aria-label={`${t('openDetails')}: ${school.name}`}
          >
            {t('openDetails')}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
