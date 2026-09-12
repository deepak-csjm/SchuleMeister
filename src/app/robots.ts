import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

// Read the origin at request time, not at build time - see src/app/sitemap.ts.
export const dynamic = 'force-dynamic';

/**
 * The parent-facing pages should be indexed - being findable is the point of
 * the product. The staff area and the auth endpoints must not be.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/signin'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
