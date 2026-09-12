import { MailCheck } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CheckEmailPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailCheck aria-hidden className="size-5 text-primary" />
            {t('checkEmailTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('checkEmailBody')}</p>
          <Link href="/signin" className="text-sm text-primary hover:underline">
            {t('backToSignIn')}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
