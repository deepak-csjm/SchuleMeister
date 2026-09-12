import { defineRouting } from 'next-intl/routing';

/**
 * German is the default locale and is served without a prefix (`/`), the other
 * locales are prefixed (`/en`, `/tr`, `/uk`, `/ar`).
 */
export const routing = defineRouting({
  locales: ['de', 'en', 'tr', 'uk', 'ar'],
  defaultLocale: 'de',
  localePrefix: 'as-needed',
  // Locale detection relies on the Accept-Language header only. next-intl would
  // otherwise persist the choice in a NEXT_LOCALE cookie, which we avoid to keep
  // the parent-facing side of the app cookie-free (see docs/PRIVACY.md).
  localeCookie: false,
});

export type Locale = (typeof routing.locales)[number];

/** Locales that must be rendered right-to-left. */
export const rtlLocales: readonly Locale[] = ['ar'];

export function localeDirection(locale: Locale): 'rtl' | 'ltr' {
  return rtlLocales.includes(locale) ? 'rtl' : 'ltr';
}
