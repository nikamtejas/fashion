/** Minimal in-memory fixed-window rate limiter — no Redis/distributed store
 * in this deployment, so this only protects a single instance, but that's
 * exactly what's running today. Purpose-built for OTP request/verify
 * endpoints (a 6-digit code has only 900,000 combinations and nothing else
 * in the app throttles attempts against it) rather than a general-purpose
 * HTTP rate limiter. */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Buckets never get cleaned up otherwise — a long-running process would
// otherwise accumulate one entry per distinct key (email/phone/IP) forever.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, SWEEP_INTERVAL_MS).unref();

/** Returns true if the call under `key` is allowed, false if the caller has
 * exceeded `max` calls within the current `windowMs` window. */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}
