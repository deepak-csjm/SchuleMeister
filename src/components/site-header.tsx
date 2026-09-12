import { Compass, LogIn } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Link } from '@/i18n/navigation';

/**
 * Public header.
 *
 * Deliberately does NOT read the session: touching the auth cookie here would
 * make every public page uncacheable and would add a database round-trip per
 * page view. The "for schools" link points at /signin, which forwards an
 * already signed-in user to the admin panel.
 */
export async function SiteHeader() {
  const t = await getTranslations();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Compass aria-hidden className="size-5 text-primary" />
          <span>{t('common.appName')}</span>
        </Link>

        <nav className="ms-auto flex items-center gap-2 text-sm" aria-label={t('nav.mainNavigation')}>
          {/*
            LocaleSwitcher reads the query string, so it needs a Suspense
            boundary to keep the surrounding pages statically prerenderable.
          */}
          <Suspense fallback={<div className="h-9 w-28" />}>
            <LocaleSwitcher />
          </Suspense>
          <Link
            href="/signin"
            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogIn aria-hidden className="size-4" />
            {t('footer.forSchools')}
          </Link>
        </nav>
      </div>
    </header>
  );
}
