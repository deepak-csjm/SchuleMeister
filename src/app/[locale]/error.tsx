'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Locale-aware error boundary. The message stays generic on purpose: internal
 * error details must not reach the browser.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');

  useEffect(() => {
    console.error('[render] unhandled error', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-md space-y-4 py-8 text-center">
      <TriangleAlert aria-hidden className="mx-auto size-10 text-destructive" />
      <h1 className="text-xl font-semibold">{t('unexpectedError')}</h1>
      <Button type="button" variant="outline" onClick={reset}>
        {t('reset')}
      </Button>
    </div>
  );
}
