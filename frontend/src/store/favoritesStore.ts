import { create } from "zustand";

// Minimal shape for Milestone 1 (navbar favorites-count badge only).
// Full favorites persistence and server sync land in Milestone 2.
interface FavoritesStore {
  count: number;
  setCount: (count: number) => void;
}

export const useFavoritesStore = create<FavoritesStore>((set) => ({
  count: 0,
  setCount: (count) => set({ count }),
}));
