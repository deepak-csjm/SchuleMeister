'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import type { MapMarker } from './school-map';

/**
 * Leaflet's default marker icons are resolved relative to the CSS file, which
 * breaks under the Next.js asset pipeline. A small inline SVG marker avoids the
 * extra requests entirely.
 */
const markerIcon = L.divIcon({
  className: 'schulkompass-marker',
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="#1d4ed8" stroke="#ffffff" stroke-width="1.5" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#ffffff" stroke="none"/></svg>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -26],
});

export function LeafletMap({
  markers,
  center,
  zoom,
  attribution,
}: {
  markers: MapMarker[];
  center: { latitude: number; longitude: number };
  zoom: number;
  attribution: string;
}) {
  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={zoom}
      scrollWheelZoom={false}
      className="h-64 w-full sm:h-80"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution={attribution}
        maxZoom={19}
      />
      {markers.map((marker) => (
        <Marker key={marker.id} position={[marker.latitude, marker.longitude]} icon={markerIcon}>
          <Popup>{marker.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
