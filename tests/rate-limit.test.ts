import { beforeEach, describe, expect, it } from 'vitest';
import { rateLimit, resetRateLimits } from '@/lib/rate-limit';

describe('rateLimit', () => {
  beforeEach(() => resetRateLimits());

  it('allows requests up to the limit and blocks afterwards', () => {
    const now = 1_000_000;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect(rateLimit('key', 3, 60_000, now).success).toBe(true);
    }
    expect(rateLimit('key', 3, 60_000, now).success).toBe(false);
  });

  it('reports the remaining budget', () => {
    const now = 1_000_000;
    expect(rateLimit('key', 3, 60_000, now).remaining).toBe(2);
    expect(rateLimit('key', 3, 60_000, now).remaining).toBe(1);
    expect(rateLimit('key', 3, 60_000, now).remaining).toBe(0);
  });

  it('opens a fresh window once the old one expires', () => {
    const now = 1_000_000;
    rateLimit('key', 1, 60_000, now);
    expect(rateLimit('key', 1, 60_000, now + 59_999).success).toBe(false);
    expect(rateLimit('key', 1, 60_000, now + 60_000).success).toBe(true);
  });

  it('keeps buckets independent', () => {
    const now = 1_000_000;
    rateLimit('a', 1, 60_000, now);
    expect(rateLimit('a', 1, 60_000, now).success).toBe(false);
    expect(rateLimit('b', 1, 60_000, now).success).toBe(true);
  });

  it('exposes the window reset timestamp', () => {
    const now = 1_000_000;
    expect(rateLimit('key', 2, 60_000, now).resetAt).toBe(now + 60_000);
    // A second call inside the window keeps the original reset time.
    expect(rateLimit('key', 2, 60_000, now + 10_000).resetAt).toBe(now + 60_000);
  });
});
