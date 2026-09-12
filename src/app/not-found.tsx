import Link from 'next/link';
import './globals.css';

/**
 * Fallback for paths outside the `[locale]` segment (for example a stray
 * top-level URL). Locale-aware 404s are handled by `[locale]/not-found.tsx`.
 *
 * Uses stylesheet classes rather than inline `style` attributes so that
 * `style-src` in the Content-Security-Policy can stay free of 'unsafe-inline'.
 */
export default function RootNotFound() {
  return (
    <html lang="de">
      <body className="grid min-h-dvh place-items-center p-4 text-center">
        <main className="space-y-3">
          <h1 className="text-xl font-semibold">Seite nicht gefunden</h1>
          <p>
            <Link href="/" className="text-primary underline">
              Zur Schulsuche
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
