import type { ReactNode } from 'react';

/**
 * Next.js requires a root layout. `<html>` and `<body>` live in
 * `[locale]/layout.tsx` because the `lang` and `dir` attributes depend on the
 * negotiated locale.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
