"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useCartStore } from "@/store/cartStore";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: "CUSTOMER" | "ADMIN";
  image?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const data = await apiFetch<{ user: AuthUser | null }>("/api/auth/me");
      setUser(data.user);
      if (data.user) {
        useFavoritesStore.getState().refresh();
        useCartStore.getState().refresh();
      } else {
        useFavoritesStore.getState().clear();
        useCartStore.getState().clear();
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // Fetch-on-mount to hydrate session from the backend's httpOnly cookie —
    // the standard data-fetching-effect pattern; setState happens inside the
    // async `refresh` callback, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const logout = React.useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    useFavoritesStore.getState().clear();
    useCartStore.getState().clear();
  }, []);

  return <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}
