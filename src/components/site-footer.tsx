import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function SiteFooter() {
  const t = await getTranslations();

  return (
    <footer className="mt-12 border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>{t('footer.openData')}</p>
        <nav className="flex gap-4">
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            {t('nav.privacy')}
          </Link>
          <Link href="/signin" className="hover:text-foreground hover:underline">
            {t('footer.forSchools')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
