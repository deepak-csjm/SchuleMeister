import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DetailRow, UnconfiguredNotice } from '@/components/legal-notice';
import { routing } from '@/i18n/routing';
import { absoluteUrl } from '@/lib/site-url';
import { isOperatorConfigured, operator, unconfiguredFields } from '@/config/operator';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'imprint' });
  return {
    title: t('title'),
    alternates: {
      canonical: absoluteUrl('/imprint', locale),
      languages: Object.fromEntries(
        routing.locales.map((candidate) => [candidate, absoluteUrl('/imprint', candidate)]),
      ),
    },
  };
}

export default async function ImprintPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('imprint');
  const configured = isOperatorConfigured();

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>

      {!configured && (
        <UnconfiguredNotice
          title={t('notConfiguredTitle')}
          body={t('notConfiguredBody')}
          fields={unconfiguredFields()}
        />
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('providerHeading')}</h2>
        <dl className="space-y-3">
          <DetailRow label={t('providerHeading')}>{operator.legalName}</DetailRow>
          <DetailRow label={t('legalForm')}>{operator.legalForm}</DetailRow>
          <DetailRow label={t('representedBy')}>{operator.representedBy}</DetailRow>
          <DetailRow label={t('addressHeading')}>
            {operator.address.street}
            <br />
            {operator.address.postalCode} {operator.address.city}
            <br />
            {operator.address.country}
          </DetailRow>
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('contactHeading')}</h2>
        <dl className="space-y-3">
          <DetailRow label={t('phone')}>{operator.contact.phone}</DetailRow>
          <DetailRow label={t('email')}>{operator.contact.email}</DetailRow>
        </dl>
      </section>

      {operator.register && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t('registerHeading')}</h2>
          <dl className="space-y-3">
            <DetailRow label={t('registerCourt')}>{operator.register.court}</DetailRow>
            <DetailRow label={t('registerNumber')}>{operator.register.number}</DetailRow>
          </dl>
        </section>
      )}

      {operator.vatId && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t('vatIdHeading')}</h2>
          <p>{operator.vatId}</p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('contentResponsibleHeading')}</h2>
        <p>
          {operator.contentResponsible.name}
          <br />
          {operator.contentResponsible.address}
        </p>
      </section>

      {operator.supervisoryAuthority && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t('supervisoryAuthorityHeading')}</h2>
          <p>{operator.supervisoryAuthority}</p>
        </section>
      )}

      <p className="text-sm text-muted-foreground">{t('schoolContentNote')}</p>
      {locale !== routing.defaultLocale && (
        <p className="text-sm text-muted-foreground">{t('authoritativeLanguage')}</p>
      )}
    </article>
  );
}
