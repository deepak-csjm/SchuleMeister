import { CalendarPlus, Clock, MapPin, Users } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PublicEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: Date;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  eventType: 'OPEN_HOUSE' | 'INFO_EVENING' | 'REGISTRATION' | 'OTHER';
  targetGrade: string | null;
}

export function EventList({ events }: { events: PublicEvent[] }) {
  const t = useTranslations('events');
  const tSchool = useTranslations('school');
  const tType = useTranslations('eventType');
  const format = useFormatter();

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{tSchool('noEvents')}</p>;
  }

  return (
    <ul className="space-y-3">
      {events.map((event) => (
        <li key={event.id}>
          <Card>
            <CardHeader>
              <Badge variant="default" className="w-fit">
                {tType(event.eventType)}
              </Badge>
              <CardTitle className="text-base">{event.title}</CardTitle>
              <p className="text-sm font-medium">
                {format.dateTime(event.eventDate, {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </CardHeader>

            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Clock aria-hidden className="size-4 shrink-0" />
                {event.startTime && event.endTime
                  ? t('fromTo', { start: event.startTime, end: event.endTime })
                  : event.startTime
                    ? t('at', { time: event.startTime })
                    : t('allDay')}
              </p>

              {event.location && (
                <p className="flex items-center gap-2">
                  <MapPin aria-hidden className="size-4 shrink-0" />
                  {event.location}
                </p>
              )}

              {event.targetGrade && (
                <p className="flex items-center gap-2">
                  <Users aria-hidden className="size-4 shrink-0" />
                  {t('targetGrade')}: {event.targetGrade}
                </p>
              )}

              {event.description && <p className="text-foreground">{event.description}</p>}

              {/*
                A plain link to the .ics route: no client-side JavaScript, works
                with the browser's native download handling on iOS and Android.
              */}
              <a
                href={`/api/events/${event.id}/ics`}
                download
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-1')}
              >
                <CalendarPlus aria-hidden />
                {t('addToCalendar')}
              </a>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
