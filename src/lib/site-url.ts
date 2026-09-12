/**
 * Canonical public origin of the deployment.
 *
 * Used for absolute URLs in the sitemap, in `robots.txt` and in the structured
 * data on school pages. `SITE_URL` wins; `AUTH_URL` is the fallback because a
 * correct deployment has to set it anyway for magic-link callbacks.
 */
let warned = false;

export function getSiteUrl(): string {
  const configured = process.env.SITE_URL ?? process.env.AUTH_URL;

  if (!configured || /^https?:\/\/localhost/.test(configured)) {
    if (process.env.NODE_ENV === 'production' && !warned) {
      warned = true;
      // A localhost origin in production means canonical tags, hreflang
      // alternates and the sitemap all point at an unreachable host.
      console.warn(
        '[site-url] SITE_URL/AUTH_URL is unset or points at localhost. Canonical URLs, ' +
          'hreflang alternates and the sitemap will be wrong. Set SITE_URL to the public origin.',
      );
    }
    return (configured ?? 'http://localhost:3000').replace(/\/+$/, '');
  }

  // A trailing slash would produce "//schools/x" once paths are appended.
  return configured.replace(/\/+$/, '');
}

/**
 * Absolute URL for a locale-prefixed path. German is served unprefixed, which
 * mirrors `localePrefix: 'as-needed'` in the i18n routing config.
 */
export function absoluteUrl(path: string, locale?: string): string {
  const base = getSiteUrl();
  const prefix = !locale || locale === 'de' ? '' : `/${locale}`;
  const normalisedPath = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${prefix}${normalisedPath}`;
  // The site root needs its trailing slash back: "https://host" is not a path.
  return url === base ? `${base}/` : url;
}
