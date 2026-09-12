/**
 * Minimal in-process fixed-window rate limiter.
 *
 * Scope: protects the magic-link endpoint against casual abuse from a single
 * instance. It is intentionally dependency-free, but the counters are per
 * process - behind several instances the effective limit multiplies. For a
 * multi-instance deployment, back this with Redis/Upstash (see
 * docs/ARCHITECTURE.md, "Known limitations").
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    // Opportunistic eviction keeps the map bounded without a timer.
    if (buckets.size >= MAX_TRACKED_KEYS) {
      for (const [candidate, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(candidate);
      }
      if (buckets.size >= MAX_TRACKED_KEYS) buckets.clear();
    }
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { success: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { success: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/** Test helper - clears all counters. */
export function resetRateLimits(): void {
  buckets.clear();
}
