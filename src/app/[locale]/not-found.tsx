import { SearchX } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default async function LocaleNotFound() {
  const t = await getTranslations('school');

  return (
    <div className="mx-auto max-w-md space-y-4 py-8 text-center">
      <SearchX aria-hidden className="mx-auto size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">{t('notFound')}</h1>
      <Button asChild variant="outline">
        <Link href="/">{t('backToSearch')}</Link>
      </Button>
    </div>
  );
}
