'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { type Locale, routing } from '@/i18n/routing';
import { Select } from '@/components/ui/input';

/**
 * Switches locale without losing the current route or query string.
 * Server-rendered messages are re-fetched by the navigation, so the UI
 * translates without a full page reload.
 */
export function LocaleSwitcher() {
  const t = useTranslations('locale');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const query = searchParams.toString();
  const target = query ? `${pathname}?${query}` : pathname;

  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">{t('label')}</span>
      <Languages aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <Select
        className="h-9 w-auto min-w-28 py-1 text-sm"
        value={locale}
        disabled={isPending}
        onChange={(event) => {
          const nextLocale = event.target.value as Locale;
          startTransition(() => {
            // `usePathname()` already returns the resolved path (including
            // dynamic segments such as the school id) without the locale
            // prefix, so it can be reused verbatim for the other locale.
            router.replace(target, { locale: nextLocale });
          });
        }}
      >
        {routing.locales.map((candidate) => (
          <option key={candidate} value={candidate}>
            {t(candidate)}
          </option>
        ))}
      </Select>
    </label>
  );
}
