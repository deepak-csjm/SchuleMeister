import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { SchoolProfileForm } from '@/components/admin/school-profile-form';
import { requireStaffUser } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';

export default async function AdminProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireStaffUser();
  const school = await prisma.school.findUnique({ where: { id: user.schoolId } });
  if (!school) notFound();

  const t = await getTranslations('admin');

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">{t('profileTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('profileIntro')}</p>
      </header>

      <SchoolProfileForm
        values={{
          name: school.name,
          address: school.address,
          postalCode: school.postalCode,
          city: school.city,
          phone: school.phone ?? '',
          email: school.email ?? '',
          website: school.website ?? '',
          headmaster: school.headmaster ?? '',
          description: school.description ?? '',
          registrationNotes: school.registrationNotes ?? '',
          hasOGS: school.hasOGS,
          languages: school.languages.join(', '),
          facilities: school.facilities.join(', '),
        }}
      />
    </section>
  );
}
