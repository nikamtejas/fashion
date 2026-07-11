"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import * as cartApi from "@/lib/cart";
import type { CartData } from "@/lib/cart";
import { ApiRequestError } from "@/lib/api";

const EMPTY_CART: CartData = { items: [], subtotal: 0, coupon: null, discount: 0, total: 0 };

interface CartContextValue {
  cart: CartData;
  isLoading: boolean;
  itemCount: number;
  refresh: () => Promise<void>;
  addItem: (input: { productId: string; variantSku?: string; qty?: number }) => Promise<void>;
  updateItem: (itemId: string, qty: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [cart, setCart] = useState<CartData>(EMPTY_CART);
  // Starts true — otherwise there's a render where "not loading" and "cart is empty"
  // are both true simultaneously, before the initial fetch has even started, which
  // makes any "redirect if cart is empty" guard fire incorrectly on a fresh mount.
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setCart(EMPTY_CART);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setCart(await cartApi.getCart());
    } catch (err) {
      if (!(err instanceof ApiRequestError && err.status === 401)) {
        console.error("Failed to load cart:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Wait for AuthContext to actually resolve first. Without this, this effect fires
    // on mount with `user` still null (AuthContext's own fetch hasn't finished yet),
    // which the branch above reads as "definitely logged out" and sets isLoading back
    // to false — then when the real user arrives a render later, isLoading is
    // incorrectly false again for one commit before this effect re-fires. Any consumer
    // gating on "not loading + empty" (e.g. checkout's empty-cart redirect) can catch
    // that one-frame window and act on stale data.
    if (authLoading) return;
    // Re-syncs the cart whenever the logged-in user changes (login/logout).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [authLoading, refresh]);

  // Every mutator below propagates errors to the caller (e.g. product detail page,
  // cart page) so each can show its own inline error — the context itself stays
  // opinion-free about how failures are displayed.
  const addItem = useCallback(
    async (input: { productId: string; variantSku?: string; qty?: number }) => {
      setCart(await cartApi.addCartItem(input));
    },
    []
  );

  const updateItem = useCallback(async (itemId: string, qty: number) => {
    setCart(await cartApi.updateCartItem(itemId, qty));
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    setCart(await cartApi.removeCartItem(itemId));
  }, []);

  const applyCoupon = useCallback(async (code: string) => {
    setCart(await cartApi.applyCoupon(code));
  }, []);

  const removeCoupon = useCallback(async () => {
    setCart(await cartApi.removeCoupon());
  }, []);

  const itemCount = cart.items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <CartContext.Provider
      value={{ cart, isLoading, itemCount, refresh, addItem, updateItem, removeItem, applyCoupon, removeCoupon }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
