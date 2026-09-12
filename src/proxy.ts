import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const SESSION_COOKIES = ['__Secure-schulkompass.session', 'schulkompass.session'];

/**
 * Next.js proxy (formerly "middleware").
 *
 * Locale negotiation for every request, plus a cheap redirect for anonymous
 * visitors who land on an admin URL.
 *
 * The cookie check below is a UX optimisation, NOT the security boundary: it
 * only looks at cookie presence, never at the signature. Authorisation is
 * enforced server-side in `requireStaffUser()` (see src/lib/auth-guard.ts),
 * which re-validates the session against the database on every admin request.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPath = /^\/(?:[a-z]{2}\/)?admin(?:\/|$)/.test(pathname);

  if (isAdminPath) {
    const hasSessionCookie = SESSION_COOKIES.some(
      (name) => request.cookies.get(name)?.value,
    );
    if (!hasSessionCookie) {
      const signInUrl = new URL('/signin', request.nextUrl.origin);
      return NextResponse.redirect(signInUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Everything except API routes, Next internals and static files.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
