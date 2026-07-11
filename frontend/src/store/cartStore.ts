import { create } from "zustand";

// Minimal shape for Milestone 1 (navbar cart-count badge only).
// Full cart line items, persistence and server sync land in Milestone 4.
interface CartStore {
  count: number;
  setCount: (count: number) => void;
}

export const useCartStore = create<CartStore>((set) => ({
  count: 0,
  setCount: (count) => set({ count }),
}));
