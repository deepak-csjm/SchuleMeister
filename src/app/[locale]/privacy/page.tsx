import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { absoluteUrl } from '@/lib/site-url';
import { operator } from '@/config/operator';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });
  return {
    title: t('title'),
    description: t('intro'),
    alternates: {
      canonical: absoluteUrl('/privacy', locale),
      languages: Object.fromEntries(
        routing.locales.map((candidate) => [candidate, absoluteUrl('/privacy', candidate)]),
      ),
    },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('privacy');
  const tLegal = await getTranslations('privacy.legal');
  const tImprint = await getTranslations('imprint');

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

      {/*
        The sections above describe the design in plain language. The ones below
        are the disclosures Art. 13 GDPR requires; the operator's own details
        come from src/config/operator.ts so they are maintained in one place
        rather than inside five message catalogues.
      */}
      <hr className="border-border" />

      <h2 className="text-xl font-bold tracking-tight">{tLegal('heading')}</h2>

      <section className="space-y-1.5">
        <h3 className="text-lg font-semibold">{tLegal('controllerHeading')}</h3>
        <p className="text-muted-foreground">{tLegal('controllerBody')}</p>
        <p>
          {operator.legalName}
          <br />
          {operator.address.street}, {operator.address.postalCode} {operator.address.city}
          <br />
          {operator.contact.email}
        </p>
        <p className="text-sm">
          <Link href="/imprint" className="text-primary hover:underline">
            {tImprint('title')}
          </Link>
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-lg font-semibold">{tLegal('dpoHeading')}</h3>
        <p>
          {operator.dataProtectionOfficer.name}
          <br />
          {operator.dataProtectionOfficer.email}
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">{tLegal('purposesHeading')}</h3>
        {[
          { title: tLegal('purposeSearchTitle'), body: tLegal('purposeSearchBody') },
          { title: tLegal('purposeStaffTitle'), body: tLegal('purposeStaffBody') },
          { title: tLegal('purposeAuditTitle'), body: tLegal('purposeAuditBody') },
        ].map((purpose) => (
          <div key={purpose.title} className="space-y-1">
            <h4 className="font-medium">{purpose.title}</h4>
            <p className="text-muted-foreground">{purpose.body}</p>
          </div>
        ))}
      </section>

      {[
        { title: tLegal('recipientsHeading'), body: tLegal('recipientsBody') },
        { title: tLegal('retentionHeading'), body: tLegal('retentionBody') },
        { title: tLegal('rightsHeading'), body: tLegal('rightsBody') },
        { title: tLegal('automatedHeading'), body: tLegal('automatedBody') },
      ].map((section) => (
        <section key={section.title} className="space-y-1.5">
          <h3 className="text-lg font-semibold">{section.title}</h3>
          <p className="text-muted-foreground">{section.body}</p>
        </section>
      ))}

      <section className="space-y-1.5">
        <h3 className="text-lg font-semibold">{tLegal('complaintHeading')}</h3>
        <p className="text-muted-foreground">
          {tLegal('complaintBody', {
            authority: operator.dataProtectionAuthority.name,
            url: operator.dataProtectionAuthority.url,
          })}
        </p>
      </section>

      {locale !== routing.defaultLocale && (
        <p className="text-sm text-muted-foreground">{tLegal('authoritativeLanguage')}</p>
      )}
    </article>
  );
}
