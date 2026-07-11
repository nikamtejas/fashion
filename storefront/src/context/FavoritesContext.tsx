"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { listFavorites, addFavorite, removeFavorite } from "@/lib/favorites";
import { ApiRequestError } from "@/lib/api";

interface FavoritesContextValue {
  favoriteIds: Set<string>;
  isLoading: boolean;
  toggleFavorite: (productId: string) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  // Starts true — see the identical comment in CartContext for why (avoids a render
  // where "not loading" and "empty" are both true before the initial fetch starts).
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setFavoriteIds(new Set());
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { items } = await listFavorites();
      setFavoriteIds(new Set(items.map((p) => p.id)));
    } catch (err) {
      if (!(err instanceof ApiRequestError && err.status === 401)) {
        console.error("Failed to load favorites:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // See the identical guard + comment in CartContext — waits for AuthContext to
    // actually resolve before treating "no user yet" as "logged out".
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [authLoading, refresh]);

  const toggleFavorite = useCallback(
    async (productId: string) => {
      if (!user) return;
      const wasFavorited = favoriteIds.has(productId);

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.delete(productId);
        else next.add(productId);
        return next;
      });

      try {
        if (wasFavorited) {
          await removeFavorite(productId);
        } else {
          await addFavorite(productId);
        }
      } catch (err) {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorited) next.add(productId);
          else next.delete(productId);
          return next;
        });
        console.error("Failed to toggle favorite:", err);
      }
    },
    [user, favoriteIds]
  );

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isLoading, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return ctx;
}
