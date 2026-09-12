import { describe, expect, it } from 'vitest';
import {
  boundingBox,
  clampRadiusKm,
  formatDistanceKm,
  haversineDistanceKm,
  isGermanPostalCode,
  isValidCoordinates,
} from '@/lib/geo';

const duesseldorfHbf = { latitude: 51.2199, longitude: 6.7943 };
const koelnHbf = { latitude: 50.9432, longitude: 6.9583 };

describe('haversineDistanceKm', () => {
  it('is zero for identical points', () => {
    expect(haversineDistanceKm(duesseldorfHbf, duesseldorfHbf)).toBe(0);
  });

  it('matches the great-circle distance Düsseldorf - Köln (~32.8 km)', () => {
    // Cross-checked against the equirectangular approximation:
    // dLat 0.2767 deg ~ 30.8 km, dLon 0.164 deg * cos(51.08 deg) ~ 11.5 km,
    // hypotenuse ~ 32.8 km. (Road distance is longer - this is the air line.)
    const distance = haversineDistanceKm(duesseldorfHbf, koelnHbf);
    expect(distance).toBeCloseTo(32.83, 1);
  });

  it('is symmetric', () => {
    expect(haversineDistanceKm(duesseldorfHbf, koelnHbf)).toBeCloseTo(
      haversineDistanceKm(koelnHbf, duesseldorfHbf),
      10,
    );
  });

  it('resolves one degree of latitude to ~111 km', () => {
    const distance = haversineDistanceKm(
      { latitude: 51, longitude: 6.8 },
      { latitude: 52, longitude: 6.8 },
    );
    expect(distance).toBeCloseTo(111.2, 0);
  });
});

describe('boundingBox', () => {
  it('contains every point within the radius', () => {
    const radiusKm = 5;
    const box = boundingBox(duesseldorfHbf, radiusKm);

    // Sample the circle; the box must be a superset of it.
    for (let bearing = 0; bearing < 360; bearing += 15) {
      const radians = (bearing * Math.PI) / 180;
      const latitude = duesseldorfHbf.latitude + (radiusKm / 111.2) * Math.cos(radians);
      const longitude =
        duesseldorfHbf.longitude +
        (radiusKm / (111.2 * Math.cos((duesseldorfHbf.latitude * Math.PI) / 180))) *
          Math.sin(radians);

      expect(latitude).toBeGreaterThanOrEqual(box.minLatitude - 1e-9);
      expect(latitude).toBeLessThanOrEqual(box.maxLatitude + 1e-9);
      expect(longitude).toBeGreaterThanOrEqual(box.minLongitude - 1e-9);
      expect(longitude).toBeLessThanOrEqual(box.maxLongitude + 1e-9);
    }
  });

  it('is wider in longitude than in latitude at German latitudes', () => {
    const box = boundingBox(duesseldorfHbf, 10);
    expect(box.maxLongitude - box.minLongitude).toBeGreaterThan(
      box.maxLatitude - box.minLatitude,
    );
  });

  it('clamps to valid coordinate ranges near the poles', () => {
    const box = boundingBox({ latitude: 89.99, longitude: 179.99 }, 50);
    expect(box.maxLatitude).toBeLessThanOrEqual(90);
    expect(box.maxLongitude).toBeLessThanOrEqual(180);
    expect(box.minLongitude).toBeGreaterThanOrEqual(-180);
  });
});

describe('isGermanPostalCode', () => {
  it.each(['40210', '00000', ' 40213 '])('accepts %s', (value) => {
    expect(isGermanPostalCode(value)).toBe(true);
  });

  it.each(['4021', '402100', 'abcde', '', '4021a'])('rejects %s', (value) => {
    expect(isGermanPostalCode(value)).toBe(false);
  });
});

describe('clampRadiusKm', () => {
  it('falls back to the default for unusable input', () => {
    expect(clampRadiusKm(undefined)).toBe(5);
    expect(clampRadiusKm('abc')).toBe(5);
    expect(clampRadiusKm(-3)).toBe(5);
    expect(clampRadiusKm(0)).toBe(5);
  });

  it('caps the radius at 50 km', () => {
    expect(clampRadiusKm(500)).toBe(50);
  });

  it('keeps values inside the allowed range', () => {
    expect(clampRadiusKm('12.5')).toBe(12.5);
    expect(clampRadiusKm(0.5)).toBe(0.5);
  });
});

describe('isValidCoordinates', () => {
  it('accepts valid pairs and rejects invalid ones', () => {
    expect(isValidCoordinates(duesseldorfHbf)).toBe(true);
    expect(isValidCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidCoordinates({ latitude: 0, longitude: 181 })).toBe(false);
    expect(isValidCoordinates({ latitude: Number.NaN, longitude: 0 })).toBe(false);
    expect(isValidCoordinates({ latitude: 0 })).toBe(false);
  });
});

describe('formatDistanceKm', () => {
  it('uses one decimal below 10 km and whole numbers above', () => {
    expect(formatDistanceKm(0.42)).toBe('0.4');
    expect(formatDistanceKm(9.96)).toBe('10.0');
    expect(formatDistanceKm(12.4)).toBe('12');
  });
});
