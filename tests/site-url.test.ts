import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { absoluteUrl, getSiteUrl } from '@/lib/site-url';

const original = { SITE_URL: process.env.SITE_URL, AUTH_URL: process.env.AUTH_URL };

beforeEach(() => {
  delete process.env.SITE_URL;
  delete process.env.AUTH_URL;
});

afterEach(() => {
  process.env.SITE_URL = original.SITE_URL;
  process.env.AUTH_URL = original.AUTH_URL;
});

describe('getSiteUrl', () => {
  it('prefers SITE_URL', () => {
    process.env.SITE_URL = 'https://schulkompass.nrw';
    process.env.AUTH_URL = 'https://other.example';
    expect(getSiteUrl()).toBe('https://schulkompass.nrw');
  });

  it('falls back to AUTH_URL', () => {
    process.env.AUTH_URL = 'https://auth.example';
    expect(getSiteUrl()).toBe('https://auth.example');
  });

  it('strips trailing slashes so appended paths do not double up', () => {
    process.env.SITE_URL = 'https://schulkompass.nrw///';
    expect(getSiteUrl()).toBe('https://schulkompass.nrw');
    expect(absoluteUrl('/schools/1')).toBe('https://schulkompass.nrw/schools/1');
  });
});

describe('absoluteUrl', () => {
  beforeEach(() => {
    process.env.SITE_URL = 'https://schulkompass.nrw';
  });

  it('leaves German unprefixed and prefixes the other locales', () => {
    expect(absoluteUrl('/schools/1', 'de')).toBe('https://schulkompass.nrw/schools/1');
    expect(absoluteUrl('/schools/1', 'ar')).toBe('https://schulkompass.nrw/ar/schools/1');
    expect(absoluteUrl('/schools/1')).toBe('https://schulkompass.nrw/schools/1');
  });

  it('never produces a double slash for the root path', () => {
    expect(absoluteUrl('/')).toBe('https://schulkompass.nrw/');
    expect(absoluteUrl('/', 'en')).toBe('https://schulkompass.nrw/en');
  });

  it('accepts paths without a leading slash', () => {
    expect(absoluteUrl('privacy', 'tr')).toBe('https://schulkompass.nrw/tr/privacy');
  });
});
