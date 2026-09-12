'use client';

import { LocateFixed, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from '@/i18n/navigation';
import { DEFAULT_RADIUS_KM, RADIUS_OPTIONS_KM } from '@/lib/geo';

const SCHOOL_TYPES = [
  'GRUNDSCHULE',
  'HAUPTSCHULE',
  'REALSCHULE',
  'GYMNASIUM',
  'GESAMTSCHULE',
  'FOERDERSCHULE',
  'BERUFSKOLLEG',
] as const;

export interface SearchFormProps {
  languages: string[];
}

/**
 * Search and filter controls.
 *
 * State lives in the URL: results are rendered on the server, links are
 * shareable, and the back button behaves as users expect. Nothing is persisted
 * in cookies or local storage.
 */
export function SearchForm({ languages }: SearchFormProps) {
  const t = useTranslations('search');
  const tCommon = useTranslations('common');
  const tType = useTranslations('schoolType');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const current = (key: string) => searchParams.get(key) ?? '';

  const navigate = (params: URLSearchParams) => {
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/?${query}` : '/');
    });
  };

  const submit = (formData: FormData) => {
    const params = new URLSearchParams();
    const q = String(formData.get('q') ?? '').trim();
    if (q) params.set('q', q);

    const radius = String(formData.get('radius') ?? '');
    if (radius && radius !== String(DEFAULT_RADIUS_KM)) params.set('radius', radius);

    const type = String(formData.get('type') ?? '');
    if (type) params.set('type', type);

    const language = String(formData.get('language') ?? '');
    if (language) params.set('language', language);

    if (formData.get('ogs')) params.set('ogs', 'true');
    if (formData.get('openHouse')) params.set('openHouse', 'true');

    // A text query replaces a previously used device location.
    if (!q) {
      const lat = searchParams.get('lat');
      const lng = searchParams.get('lng');
      if (lat && lng) {
        params.set('lat', lat);
        params.set('lng', lng);
      }
    }

    navigate(params);
  };

  const useDeviceLocation = () => {
    setGeoError(null);
    if (!('geolocation' in navigator)) {
      setGeoError(t('geolocationUnsupported'));
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const params = new URLSearchParams(searchParams.toString());
        params.delete('q');
        // Three decimals (~100 m) are precise enough for a radius search and
        // deliberately coarse so the exact position never reaches the server.
        params.set('lat', position.coords.latitude.toFixed(3));
        params.set('lng', position.coords.longitude.toFixed(3));
        navigate(params);
      },
      () => {
        setLocating(false);
        setGeoError(t('geolocationDenied'));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const hasFilters = Array.from(searchParams.keys()).length > 0;

  return (
    <form action={submit} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="q">{t('locationLabel')}</Label>
          <Input
            id="q"
            name="q"
            defaultValue={current('q')}
            placeholder={t('locationPlaceholder')}
            inputMode="text"
            autoComplete="postal-code"
            className="mt-1.5"
          />
        </div>
        <div className="sm:w-40">
          <Label htmlFor="radius">{t('radiusLabel')}</Label>
          <Select
            id="radius"
            name="radius"
            defaultValue={current('radius') || String(DEFAULT_RADIUS_KM)}
            className="mt-1.5"
          >
            {RADIUS_OPTIONS_KM.map((km) => (
              <option key={km} value={km}>
                {t('radiusValue', { km })}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="type">{t('schoolTypeLabel')}</Label>
          <Select id="type" name="type" defaultValue={current('type')} className="mt-1.5">
            <option value="">{t('allSchoolTypes')}</option>
            {SCHOOL_TYPES.map((type) => (
              <option key={type} value={type}>
                {tType(type)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="language">{t('languageLabel')}</Label>
          <Select
            id="language"
            name="language"
            defaultValue={current('language')}
            className="mt-1.5"
            disabled={languages.length === 0}
          >
            <option value="">{t('allLanguages')}</option>
            {languages.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t('filters')}</legend>
        <label htmlFor="ogs" className="flex items-start gap-2.5 text-sm">
          <input
            id="ogs"
            type="checkbox"
            name="ogs"
            defaultChecked={current('ogs') === 'true'}
            className="mt-0.5 size-5 rounded border-input accent-[var(--primary)]"
          />
          <span>{t('ogsLabel')}</span>
        </label>
        <label htmlFor="openHouse" className="flex items-start gap-2.5 text-sm">
          <input
            id="openHouse"
            type="checkbox"
            name="openHouse"
            defaultChecked={current('openHouse') === 'true'}
            className="mt-0.5 size-5 rounded border-input accent-[var(--primary)]"
          />
          <span>{t('openHouseLabel')}</span>
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending} className="flex-1 sm:flex-none">
          <Search aria-hidden />
          {tCommon('search')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={useDeviceLocation}
          disabled={locating || isPending}
        >
          <LocateFixed aria-hidden />
          {locating ? t('locating') : t('useMyLocation')}
        </Button>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(new URLSearchParams())}
            disabled={isPending}
          >
            <X aria-hidden />
            {tCommon('reset')}
          </Button>
        )}
      </div>

      {geoError && (
        <p role="alert" className="text-sm text-destructive">
          {geoError}
        </p>
      )}
    </form>
  );
}
