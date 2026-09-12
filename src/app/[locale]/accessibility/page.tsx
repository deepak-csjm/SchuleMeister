import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { absoluteUrl, getSiteUrl } from '@/lib/site-url';
import { operator } from '@/config/operator';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'accessibility' });
  return {
    title: t('title'),
    alternates: {
      canonical: absoluteUrl('/accessibility', locale),
      languages: Object.fromEntries(
        routing.locales.map((candidate) => [candidate, absoluteUrl('/accessibility', candidate)]),
      ),
    },
  };
}

export default async function AccessibilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('accessibility');
  const format = await getFormatter();

  const assessedOn = format.dateTime(new Date(operator.accessibilityAssessedOn), {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const limitations = [
    { title: t('limitationsMapTitle'), body: t('limitationsMapBody') },
    { title: t('limitationsSchoolTextTitle'), body: t('limitationsSchoolTextBody') },
    { title: t('limitationsScreenReaderTitle'), body: t('limitationsScreenReaderBody') },
  ];

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro', { url: getSiteUrl() })}</p>
      </header>

      <section className="space-y-1.5">
        <h2 className="text-lg font-semibold">{t('statusHeading')}</h2>
        <p className="text-muted-foreground">{t('statusBody')}</p>
      </section>

      <section className="space-y-1.5">
        <h2 className="text-lg font-semibold">{t('testedHeading')}</h2>
        <p className="text-muted-foreground">{t('testedBody', { date: assessedOn })}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('limitationsHeading')}</h2>
        {limitations.map((item) => (
          <div key={item.title} className="space-y-1">
            <h3 className="font-medium">{item.title}</h3>
            <p className="text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </section>

      <section className="space-y-1.5">
        <h2 className="text-lg font-semibold">{t('feedbackHeading')}</h2>
        <p className="text-muted-foreground">
          {t('feedbackBody', { email: operator.accessibility.contactEmail })}
        </p>
      </section>

      <section className="space-y-1.5">
        <h2 className="text-lg font-semibold">{t('enforcementHeading')}</h2>
        <p className="text-muted-foreground">
          {t('enforcementBody', {
            body: operator.accessibility.enforcementBody,
            url: operator.accessibility.enforcementUrl,
          })}
        </p>
      </section>
    </article>
  );
}
