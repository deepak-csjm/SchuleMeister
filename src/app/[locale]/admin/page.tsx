import { CalendarDays, FileClock, School } from 'lucide-react';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { startOfTodayInAppZone } from '@/lib/datetime';
import { requireStaffUser } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireStaffUser();
  const today = startOfTodayInAppZone();

  const [school, upcomingCount, publishedCount, auditLogs] = await Promise.all([
    prisma.school.findUnique({ where: { id: user.schoolId } }),
    prisma.event.count({
      where: { schoolId: user.schoolId, isPublished: true, eventDate: { gte: today } },
    }),
    prisma.event.count({ where: { schoolId: user.schoolId } }),
    prisma.auditLog.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const t = await getTranslations('admin');
  const tSchool = await getTranslations('school');
  const tActions = await getTranslations('admin.actions');
  const format = await getFormatter();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays aria-hidden className="size-4" />
              {t('eventsNav')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{upcomingCount}</p>
            <p className="text-sm text-muted-foreground">
              {publishedCount} {t('eventsNav').toLowerCase()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <School aria-hidden className="size-4" />
              {t('school')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="font-semibold">{school?.name}</p>
            <Badge variant={school?.hasOGS ? 'success' : 'muted'}>
              {school?.hasOGS ? tSchool('ogsAvailable') : tSchool('ogsUnavailable')}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {t('role')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">
              {user.role === 'SUPER_ADMIN' ? t('roleSuperAdmin') : t('roleSecretary')}
            </p>
            {school && (
              <p className="text-sm text-muted-foreground">
                {tSchool('lastUpdated', {
                  date: format.dateTime(school.updatedAt, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  }),
                })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileClock aria-hidden className="size-4 text-muted-foreground" />
            {t('recentChanges')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noChanges')}</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {auditLogs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-medium">
                    {/* Unknown actions (e.g. added by a later migration) fall
                        back to the raw identifier rather than throwing. */}
                    {tActions.has(log.action) ? tActions(log.action) : log.action}
                  </span>
                  <span className="text-muted-foreground">
                    {format.dateTime(log.createdAt, {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="text-muted-foreground">· {log.actorEmail}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
