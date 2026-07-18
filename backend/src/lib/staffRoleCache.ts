import { User } from "../models/User";

/** Sessions are self-contained JWTs — requireAdmin/requireOps/requireCatalog
 * used to trust the `role` claim baked into the token at login time with no
 * re-check against the database, so deleting or demoting a staff account
 * didn't take effect until their token naturally expired (up to 30 days).
 * Re-reading the DB on every single admin request would fix that instantly
 * but adds a real network round trip to Atlas on every admin call; this
 * caches each uid's current role for a short window instead, so a
 * revocation takes effect within seconds rather than weeks, without paying
 * a DB read per request. */
const TTL_MS = 60_000;

interface CacheEntry {
  role: string | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

// A revocation (invalidateStaffRoleCache) racing a concurrent cache-miss
// read for the same uid could otherwise write the stale pre-revocation
// role right back into the cache — the DB read starts, yields the event
// loop while awaiting Atlas, the revocation lands and clears the entry,
// and then the in-flight read's `cache.set` overwrites it with what it
// already had in hand, resurrecting the stale role for another full TTL.
// Recording *when* each uid was last invalidated lets a read that started
// before that moment recognize it fetched a possibly-stale value and skip
// caching it (the caller still gets a correct one-off answer either way —
// this only decides whether it's safe to reuse for the next TTL window).
const invalidatedAt = new Map<string, number>();

export async function getCurrentRole(uid: string): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(uid);
  if (cached && now < cached.expiresAt) return cached.role;

  const readStartedAt = now;
  const user = await User.findById(uid).select("role").lean();
  const role = user?.role ?? null;

  const invalidatedSince = invalidatedAt.get(uid);
  if (invalidatedSince && invalidatedSince > readStartedAt) {
    // Superseded by a revocation that landed mid-read — this result may
    // already be stale, so hand it back without caching it.
    return role;
  }
  cache.set(uid, { role, expiresAt: now + TTL_MS });
  return role;
}

/** Called wherever a role is granted/changed so the new privilege level (or
 * lack thereof) is visible immediately instead of waiting out the TTL. */
export function invalidateStaffRoleCache(uid: string) {
  cache.delete(uid);
  invalidatedAt.set(uid, Date.now());
}

// Neither map otherwise shrinks — an entry only ever gets touched again if
// the same uid makes another request, so a one-off caller (a scanner probing
// admin routes while merely logged in as a customer, a staffer who leaves)
// would sit in memory forever for the life of the process. Mirrors the same
// sweep pattern already used in lib/rateLimit.ts.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [uid, entry] of cache) {
    if (now >= entry.expiresAt) cache.delete(uid);
  }
  for (const [uid, ts] of invalidatedAt) {
    if (now - ts > TTL_MS) invalidatedAt.delete(uid);
  }
}, SWEEP_INTERVAL_MS).unref();
