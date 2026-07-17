import { create } from "zustand";
import { apiFetch } from "@/lib/api";

interface FavoritesStore {
  ids: Set<string>;
  loaded: boolean;
  count: number;
  refresh: () => Promise<void>;
  toggle: (productId: string) => Promise<void>;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  ids: new Set(),
  loaded: false,
  count: 0,

  refresh: async () => {
    try {
      const data = await apiFetch<{ ids: string[] }>("/api/favorites/ids");
      set({ ids: new Set(data.ids), loaded: true, count: data.ids.length });
    } catch {
      set({ ids: new Set(), loaded: true, count: 0 });
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
        return { ids: rolledBack, count: rolledBack.size };
      });
      throw err;
    }
  },

  clear: () => set({ ids: new Set(), loaded: false, count: 0 }),
}));
