import { TriangleAlert } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Maps Auth.js error codes to translation keys. */
function messageKey(error: string | undefined) {
  switch (error) {
    case 'AccessDenied':
      return 'errorAccessDenied' as const;
    case 'Verification':
      return 'errorVerification' as const;
    default:
      return 'errorGeneric' as const;
  }
}

export default async function AuthErrorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error } = await searchParams;
  const t = await getTranslations('auth');

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle as="h1" className="flex items-center gap-2">
            <TriangleAlert aria-hidden className="size-5 text-destructive" />
            {t('errorTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t(messageKey(error))}</p>
          <Link href="/signin" className="text-sm text-primary hover:underline">
            {t('backToSignIn')}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
