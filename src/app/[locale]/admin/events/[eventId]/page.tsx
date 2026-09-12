import { ArrowLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EventForm } from '@/components/admin/event-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { assertCanEditSchool, requireStaffUser } from '@/lib/auth-guard';
import { toDateInputValue } from '@/lib/datetime';
import { prisma } from '@/lib/prisma';

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ locale: string; eventId: string }>;
}) {
  const { locale, eventId } = await params;
  setRequestLocale(locale);

  const user = await requireStaffUser();
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();
  assertCanEditSchool(user, event.schoolId);

  const t = await getTranslations('admin');

  return (
    <section className="space-y-4">
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
        {t('eventsNav')}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('editEvent')}</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm
            values={{
              id: event.id,
              title: event.title,
              description: event.description ?? '',
              eventDate: toDateInputValue(event.eventDate),
              startTime: event.startTime ?? '',
              endTime: event.endTime ?? '',
              location: event.location ?? '',
              eventType: event.eventType,
              targetGrade: event.targetGrade ?? '',
              isPublished: event.isPublished,
            }}
          />
        </CardContent>
      </Card>
    </section>
  );
}
