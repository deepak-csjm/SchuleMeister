import { CalendarDays, ExternalLink, LayoutDashboard, LogOut, School } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { requireStaffUser } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { signOutAction } from '@/server/actions/auth';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Authoritative check: re-reads the account from the database on every
  // request, so a deactivated user loses access immediately.
  const user = await requireStaffUser();
  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { id: true, name: true },
  });

  const t = await getTranslations('admin');
  const tNav = await getTranslations('nav');

  const navItems = [
    { href: '/admin', label: t('dashboard'), icon: LayoutDashboard },
    { href: '/admin/profile', label: t('profileNav'), icon: School },
    { href: '/admin/events', label: t('eventsNav'), icon: CalendarDays },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {school?.name} · {user.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {school && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/schools/${school.id}`}>
                <ExternalLink aria-hidden />
                {t('viewPublicPage')}
              </Link>
            </Button>
          )}
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut aria-hidden />
              {tNav('signOut')}
            </Button>
          </form>
        </div>
      </div>

      <nav aria-label={t('title')} className="flex flex-wrap gap-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <item.icon aria-hidden className="size-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
