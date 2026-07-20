import { create } from "zustand";
import { apiFetch } from "@/lib/api";

const CACHE_KEY = "luxeloom:favorite-ids";
// Bounds how long a previous user's favorites can flash on a shared/kiosk
// browser before the real /api/favorites/ids call corrects it — see the
// matching note in AuthContext.tsx.
const CACHE_TTL_MS = 10 * 60 * 1000;

/** Last-known favorited IDs, so the navbar heart badge and per-product heart
 * fills show their real value on first paint instead of starting at 0/empty
 * and popping in once /api/favorites/ids resolves. */
function readCache(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { ids: string[]; cachedAt: number };
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return [];
    return parsed.ids;
  } catch {
    return [];
  }
}

function writeCache(ids: Iterable<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ids: [...ids], cachedAt: Date.now() }));
  } catch {
    // Private-mode/quota storage errors aren't worth surfacing here.
  }
}

interface FavoritesStore {
  ids: Set<string>;
  loaded: boolean;
  count: number;
  hydrateFromCache: () => void;
  refresh: () => Promise<void>;
  toggle: (productId: string) => Promise<void>;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  // Must start empty on every environment (server AND the client's first
  // hydration render) — seeding from localStorage here would read real data
  // client-side but always read nothing server-side, a mismatch between the
  // server-rendered HTML and React's first client render. `hydrateFromCache`
  // below applies the cached value a moment later instead, from a layout
  // effect that only ever runs client-side, after hydration is already done.
  ids: new Set(),
  loaded: false,
  count: 0,

  hydrateFromCache: () => {
    const cached = readCache();
    if (cached.length > 0) set({ ids: new Set(cached), count: cached.length });
  },

  refresh: async () => {
    try {
      const data = await apiFetch<{ ids: string[] }>("/api/favorites/ids");
      set({ ids: new Set(data.ids), loaded: true, count: data.ids.length });
      writeCache(data.ids);
    } catch {
      set({ ids: new Set(), loaded: true, count: 0 });
      writeCache([]);
    }
  },

  toggle: async (productId: string) => {
    const isFavorited = get().ids.has(productId);
    const next = new Set(get().ids);
    if (isFavorited) {
      next.delete(productId);
    } else {
      next.add(productId);
    }
    set({ ids: next, count: next.size });
    writeCache(next);

    try {
      if (isFavorited) {
        await apiFetch(`/api/favorites/${productId}`, { method: "DELETE" });
      } else {
        await apiFetch(`/api/favorites/${productId}`, { method: "POST" });
      }
    } catch (err) {
      // Undo just this productId's optimistic change relative to whatever
      // the store holds *now* — rolling back to a snapshot captured when
      // this call started would clobber a different concurrent toggle's
      // already-applied, already server-confirmed change (e.g. a fast
      // double-tap where this was the slower of the two requests to fail).
      set((state) => {
        const rolledBack = new Set(state.ids);
        if (isFavorited) rolledBack.add(productId);
        else rolledBack.delete(productId);
        writeCache(rolledBack);
        return { ids: rolledBack, count: rolledBack.size };
      });
      throw err;
    }
  },

  clear: () => {
    set({ ids: new Set(), loaded: false, count: 0 });
    writeCache([]);
  },
}));
