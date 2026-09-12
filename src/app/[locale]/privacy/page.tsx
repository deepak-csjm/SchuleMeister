import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });
  return { title: t('title'), description: t('intro') };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('privacy');

  const sections = [
    { title: t('noAccountTitle'), body: t('noAccountBody') },
    { title: t('cookiesTitle'), body: t('cookiesBody') },
    { title: t('locationTitle'), body: t('locationBody') },
    { title: t('mapTitle'), body: t('mapBody') },
    { title: t('hostingTitle'), body: t('hostingBody') },
  ];

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </header>
      {sections.map((section) => (
        <section key={section.title} className="space-y-1.5">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <p className="text-muted-foreground">{section.body}</p>
        </section>
      ))}
    </article>
  );
}
