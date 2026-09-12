'use client';

import { MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface MapMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * Leaflet and the tile layer are only downloaded after the visitor explicitly
 * activates the map, so a page view never sends the visitor's IP address to a
 * third party (see docs/PRIVACY.md).
 */
const LeafletMap = dynamic(() => import('./leaflet-map').then((mod) => mod.LeafletMap), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-lg bg-muted sm:h-80" />,
});

export function SchoolMap({
  markers,
  center,
  zoom = 12,
}: {
  markers: MapMarker[];
  center?: { latitude: number; longitude: number };
  zoom?: number;
}) {
  const t = useTranslations('map');
  // Deliberately not persisted: consent lasts for this page view only, which
  // keeps the app free of non-essential storage.
  const [activated, setActivated] = useState(false);

  if (markers.length === 0) return null;

  if (!activated) {
    return (
      <section
        aria-label={t('title')}
        className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-muted/40 p-4"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MapPin aria-hidden className="size-4 text-primary" />
          {t('consentTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('consentBody')}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setActivated(true)}>
          {t('loadMap')}
        </Button>
      </section>
    );
  }

  const fallbackCenter = markers[0]!;

  return (
    <section aria-label={t('title')} className="space-y-1">
      <LeafletMap
        markers={markers}
        center={center ?? { latitude: fallbackCenter.latitude, longitude: fallbackCenter.longitude }}
        zoom={zoom}
        attribution={t('attribution')}
      />
    </section>
  );
}
