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
    const { ids } = get();
    const isFavorited = ids.has(productId);
    const next = new Set(ids);
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
    } catch {
      // Roll back on failure.
      set({ ids, count: ids.size });
    }
  },

  clear: () => set({ ids: new Set(), loaded: false, count: 0 }),
}));
