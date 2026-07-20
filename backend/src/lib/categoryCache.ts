import { Category } from "../models/Category";

/** Every category-filtered shop request (`?category=men`) resolved the slug
 * to an id with its own Atlas round trip before the product query could
 * even start — on this cluster that's ~0.3-1.5s paid up front on every
 * single category-filtered page load. There's no admin UI to edit
 * categories at all (they're seed-only), so a short TTL is purely a safety
 * net, not a real staleness risk. */
const TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  id: string | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function getCategoryIdBySlug(slug: string): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(slug);
  if (cached && now < cached.expiresAt) return cached.id;

  const cat = await Category.findOne({ slug }).select("_id").lean();
  const id = cat ? String(cat._id) : null;
  cache.set(slug, { id, expiresAt: now + TTL_MS });
  return id;
}

const SWEEP_INTERVAL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [slug, entry] of cache) {
    if (now >= entry.expiresAt) cache.delete(slug);
  }
}, SWEEP_INTERVAL_MS).unref();
