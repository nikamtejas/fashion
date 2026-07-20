import { create } from "zustand";
import { apiFetch } from "@/lib/api";

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  sku: string;
  size: string;
  color: string;
  qty: number;
  unitPrice: number;
  unitGst: number;
  unitPreTax: number;
  lineTotal: number;
  stock: number;
  availableSizes: { size: string; sku: string; stock: number }[];
}

export interface SavedLine {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  sku: string;
  size: string;
  color: string;
  price: number;
  inStock: boolean;
}

export interface CartTotals {
  itemCount: number;
  preTaxSubtotal: number;
  gst: number;
  subtotal: number;
  discount: number;
  shipping: number;
  freeShippingThreshold: number;
  amountToFreeShipping: number;
  total: number;
}

export interface CartView {
  items: CartLine[];
  savedItems: SavedLine[];
  coupon: { code: string; type: string; value: number; discount: number } | null;
  totals: CartTotals;
  droppedCoupon?: { code: string; reason: string };
}

const CART_COUNT_CACHE_KEY = "luxeloom:cart-count";
// Bounds how long a previous user's cart count can flash on a shared/kiosk
// browser before the real /api/cart call corrects it — see the matching
// note in AuthContext.tsx.
const CACHE_TTL_MS = 10 * 60 * 1000;

/** Last-known item count, so the navbar bag badge shows its real value on
 * first paint instead of starting at 0 and popping in once /api/cart
 * resolves. Only the count is cached — the full cart (prices, discounts)
 * always comes fresh from the server. */
function readCachedCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(CART_COUNT_CACHE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { count: number; cachedAt: number };
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return 0;
    return parsed.count || 0;
  } catch {
    return 0;
  }
}

function writeCachedCount(count: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_COUNT_CACHE_KEY, JSON.stringify({ count, cachedAt: Date.now() }));
  } catch {
    // Private-mode/quota storage errors aren't worth surfacing here.
  }
}

const EMPTY_TOTALS: CartTotals = {
  itemCount: 0,
  preTaxSubtotal: 0,
  gst: 0,
  subtotal: 0,
  discount: 0,
  shipping: 0,
  freeShippingThreshold: 2999,
  amountToFreeShipping: 2999,
  total: 0,
};

interface CartStore {
  cart: CartView | null;
  loaded: boolean;
  drawerOpen: boolean;
  /** Navbar badge count. */
  count: number;

  openDrawer: () => void;
  closeDrawer: () => void;
  hydrateFromCache: () => void;
  refresh: () => Promise<void>;
  addItem: (productId: string, sku: string, qty?: number) => Promise<void>;
  updateItem: (sku: string, patch: { qty?: number; newSku?: string }) => Promise<void>;
  removeItem: (sku: string) => Promise<void>;
  saveForLater: (sku: string) => Promise<void>;
  moveToBag: (sku: string) => Promise<void>;
  removeSaved: (sku: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<CartView>;
  removeCoupon: () => Promise<void>;
  clear: () => void;
}

function apply(set: (partial: Partial<CartStore>) => void, cart: CartView) {
  set({ cart, loaded: true, count: cart.totals.itemCount });
  writeCachedCount(cart.totals.itemCount);
}

export const useCartStore = create<CartStore>((set) => ({
  // Must start at 0 in every environment (server AND the client's first
  // hydration render) — seeding from localStorage here would read a real
  // count client-side but always read 0 server-side, a mismatch between the
  // server-rendered HTML and React's first client render. `hydrateFromCache`
  // below applies the cached count a moment later instead, from a layout
  // effect that only ever runs client-side, after hydration is already done.
  cart: null,
  loaded: false,
  drawerOpen: false,
  count: 0,

  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  hydrateFromCache: () => {
    const cached = readCachedCount();
    if (cached > 0) set({ count: cached });
  },

  refresh: async () => {
    try {
      const data = await apiFetch<{ cart: CartView }>("/api/cart");
      apply(set, data.cart);
    } catch {
      set({ cart: { items: [], savedItems: [], coupon: null, totals: EMPTY_TOTALS }, loaded: true, count: 0 });
      writeCachedCount(0);
    }
  },

  addItem: async (productId, sku, qty = 1) => {
    const data = await apiFetch<{ cart: CartView }>("/api/cart/items", {
      method: "POST",
      json: { productId, sku, qty },
    });
    apply(set, data.cart);
    set({ drawerOpen: true });
  },

  updateItem: async (sku, patch) => {
    const data = await apiFetch<{ cart: CartView }>(`/api/cart/items/${encodeURIComponent(sku)}`, {
      method: "PATCH",
      json: patch,
    });
    apply(set, data.cart);
  },

  removeItem: async (sku) => {
    const data = await apiFetch<{ cart: CartView }>(`/api/cart/items/${encodeURIComponent(sku)}`, {
      method: "DELETE",
    });
    apply(set, data.cart);
  },

  saveForLater: async (sku) => {
    const data = await apiFetch<{ cart: CartView }>(`/api/cart/items/${encodeURIComponent(sku)}/save-for-later`, {
      method: "POST",
    });
    apply(set, data.cart);
  },

  moveToBag: async (sku) => {
    const data = await apiFetch<{ cart: CartView }>(`/api/cart/saved/${encodeURIComponent(sku)}/move-to-bag`, {
      method: "POST",
    });
    apply(set, data.cart);
  },

  removeSaved: async (sku) => {
    const data = await apiFetch<{ cart: CartView }>(`/api/cart/saved/${encodeURIComponent(sku)}`, {
      method: "DELETE",
    });
    apply(set, data.cart);
  },

  applyCoupon: async (code) => {
    const data = await apiFetch<{ cart: CartView }>("/api/cart/coupon", { method: "POST", json: { code } });
    apply(set, data.cart);
    return data.cart;
  },

  removeCoupon: async () => {
    const data = await apiFetch<{ cart: CartView }>("/api/cart/coupon", { method: "DELETE" });
    apply(set, data.cart);
  },

  clear: () => {
    set({ cart: null, loaded: false, count: 0, drawerOpen: false });
    writeCachedCount(0);
  },
}));
