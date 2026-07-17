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

export async function getCurrentRole(uid: string): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(uid);
  if (cached && now < cached.expiresAt) return cached.role;

  const user = await User.findById(uid).select("role").lean();
  const role = user?.role ?? null;
  cache.set(uid, { role, expiresAt: now + TTL_MS });
  return role;
}

/** Called wherever a role is granted/changed so the new privilege level (or
 * lack thereof) is visible immediately instead of waiting out the TTL. */
export function invalidateStaffRoleCache(uid: string) {
  cache.delete(uid);
}
