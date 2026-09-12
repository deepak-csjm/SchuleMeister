import { Pencil, Plus } from 'lucide-react';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { DeleteEventButton } from '@/components/admin/delete-event-button';
import { EventForm } from '@/components/admin/event-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { requireStaffUser } from '@/lib/auth-guard';
import { toDateInputValue } from '@/lib/datetime';
import { prisma } from '@/lib/prisma';

export default async function AdminEventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireStaffUser();
  const events = await prisma.event.findMany({
    where: { schoolId: user.schoolId },
    orderBy: { eventDate: 'desc' },
  });

  const t = await getTranslations('admin');
  const tCommon = await getTranslations('common');
  const tType = await getTranslations('eventType');
  const format = await getFormatter();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">{t('eventsTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('eventsIntro')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus aria-hidden className="size-4 text-primary" />
            {t('newEvent')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm
            values={{
              title: '',
              description: '',
              eventDate: toDateInputValue(new Date()),
              startTime: '',
              endTime: '',
              location: '',
              eventType: 'OPEN_HOUSE',
              targetGrade: '',
              isPublished: true,
            }}
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h3 className="text-base font-semibold">{t('eventsNav')}</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noEventsYet')}</p>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{tType(event.eventType)}</Badge>
                    <Badge variant={event.isPublished ? 'success' : 'muted'}>
                      {event.isPublished ? t('published') : t('unpublished')}
                    </Badge>
                  </div>
                  <p className="font-medium">{event.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {format.dateTime(event.eventDate, {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                    {event.startTime ? ` · ${event.startTime}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/events/${event.id}`}>
                      <Pencil aria-hidden />
                      {tCommon('edit')}
                    </Link>
                  </Button>
                  <DeleteEventButton eventId={event.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
