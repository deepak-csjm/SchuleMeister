import Link from 'next/link';

/**
 * Fallback for paths outside the `[locale]` segment (for example a stray
 * top-level URL). Locale-aware 404s are handled by `[locale]/not-found.tsx`.
 */
export default function RootNotFound() {
  return (
    <html lang="de">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'grid',
          placeItems: 'center',
          minHeight: '100dvh',
          margin: 0,
          textAlign: 'center',
        }}
      >
        <main>
          <h1 style={{ fontSize: '1.25rem' }}>Seite nicht gefunden</h1>
          <p>
            <Link href="/">Zur Schulsuche</Link>
          </p>
        </main>
      </body>
    </html>
  );
}
