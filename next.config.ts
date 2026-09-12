import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Content-Security-Policy.
 *
 * Tile requests only go out after the visitor explicitly activates the map
 * (see components/school-map.tsx), but the connect/img sources have to be
 * allow-listed for that opt-in to work at all.
 */
const isDev = process.env.NODE_ENV === 'development';

const csp = [
  "default-src 'self'",
  // React's development build uses eval() for its debugging features; the
  // production build never does, so 'unsafe-eval' is dev-only.
  // 'unsafe-inline' is still required here: Next.js emits inline bootstrap and
  // streaming-payload scripts on every page. Removing it means nonces, and
  // nonces require every page to be dynamically rendered (see
  // node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
  // That trade-off is revisited in docs/PRIVACY.md.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  // No inline <style> element or style="" attribute is rendered anywhere, so
  // this stays strict. Leaflet mutates element.style from JavaScript, which CSP
  // does not govern.
  "style-src 'self'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "connect-src 'self' https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keeps the parent-facing pages free of third-party requests.
  images: { remotePatterns: [] },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            // Geolocation stays enabled: it is the "search near me" feature and
            // never leaves the browser.
            value: 'camera=(), microphone=(), geolocation=(self), payment=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
