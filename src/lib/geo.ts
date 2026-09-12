/** Mean earth radius in kilometres (WGS84 mean). */
const EARTH_RADIUS_KM = 6371.0088;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

export const RADIUS_OPTIONS_KM = [1, 2, 5, 10, 20, 50] as const;
export const DEFAULT_RADIUS_KM = 5;
export const MAX_RADIUS_KM = 50;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in kilometres between two WGS84 points. */
export function haversineDistanceKm(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Bounding box around a point, used as a cheap index-friendly pre-filter before
 * the exact haversine distance is evaluated.
 */
export function boundingBox(center: Coordinates, radiusKm: number): BoundingBox {
  const latDelta = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  // Guard against division by ~0 near the poles; irrelevant for NRW but keeps
  // the function total.
  const cosLat = Math.max(Math.cos(toRadians(center.latitude)), 1e-6);
  const lonDelta = latDelta / cosLat;

  return {
    minLatitude: Math.max(center.latitude - latDelta, -90),
    maxLatitude: Math.min(center.latitude + latDelta, 90),
    minLongitude: Math.max(center.longitude - lonDelta, -180),
    maxLongitude: Math.min(center.longitude + lonDelta, 180),
  };
}

/** German postal codes are exactly five digits. */
export function isGermanPostalCode(value: string): boolean {
  return /^\d{5}$/.test(value.trim());
}

export function clampRadiusKm(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RADIUS_KM;
  return Math.min(Math.max(parsed, 0.5), MAX_RADIUS_KM);
}

export function isValidCoordinates(value: Partial<Coordinates>): value is Coordinates {
  return (
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.latitude) <= 90 &&
    Math.abs(value.longitude) <= 180
  );
}

/** Rounds a distance for display: one decimal below 10 km, integer above. */
export function formatDistanceKm(distanceKm: number): string {
  return distanceKm < 10 ? distanceKm.toFixed(1) : String(Math.round(distanceKm));
}
