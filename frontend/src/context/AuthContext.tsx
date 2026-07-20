"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useCartStore } from "@/store/cartStore";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: "CUSTOMER" | "ADMIN" | "OPS" | "CATALOG";
  image?: string;
  phone?: string;
  phoneVerified?: string;
  /** YYYY-MM-DD */
  dob?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

const USER_CACHE_KEY = "luxeloom:auth-user";
// On a shared/kiosk browser, a cache with no expiry would keep showing
// whoever last used it — name, avatar, cart/favorite counts — to the next
// person for as long as the entry sits in localStorage, until /api/auth/me
// corrects it a moment later. Bounding it to a short window shrinks that
// exposure to "someone used this browser very recently" instead of "ever."
const CACHE_TTL_MS = 10 * 60 * 1000;

/** Last-known user, so a fresh mount (hard reload, new tab) can render the
 * real profile icon immediately instead of a "loading" skeleton while
 * /api/auth/me round-trips — that flash of placeholder-then-snap is what
 * reads as the icon "refreshing" on every load. Still just a cache: the
 * network call below runs regardless and corrects this if it's stale. */
function readCachedUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user: AuthUser; cachedAt: number };
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed.user;
  } catch {
    return null;
  }
}

function writeCachedUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify({ user, cachedAt: Date.now() }));
    else window.localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // Private-mode/quota storage errors aren't worth surfacing here.
  }
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Both start at the "logged out" default on every render pass — including
  // the client's very first hydration render — so it always matches what
  // the server rendered (the server has no access to localStorage and would
  // otherwise always render this differently, a hydration mismatch that
  // itself causes a visible flash once React patches the mismatch after
  // hydrating). The layout effect below corrects this a moment later,
  // client-only, after hydration has already committed.
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useLayoutEffect(() => {
    // Runs synchronously right after mount, before the browser paints the
    // hydrated frame — so the cached snapshot appears in the very first
    // frame the user actually sees, instead of a beat after JS loads.
    const cached = readCachedUser();
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(cached);
      setLoading(false);
    }
    useFavoritesStore.getState().hydrateFromCache();
    useCartStore.getState().hydrateFromCache();
  }, []);

  const refresh = React.useCallback(async () => {
    // Both endpoints trust the session cookie directly, not this response —
    // kick them off immediately instead of waiting for /api/auth/me first.
    // Each already falls back to an empty state on its own if the session
    // turns out to be missing/expired, so no separate unauthenticated branch
    // is needed here.
    useFavoritesStore.getState().refresh();
    useCartStore.getState().refresh();
    try {
      const data = await apiFetch<{ user: AuthUser | null }>("/api/auth/me");
      setUser(data.user);
      writeCachedUser(data.user);
    } catch {
      setUser(null);
      writeCachedUser(null);
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
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // A flaky connection or already-expired session shouldn't trap the
      // user in a stuck "still looks logged in" state — clear local state
      // regardless; a fresh login re-establishes the session either way.
    } finally {
      setUser(null);
      writeCachedUser(null);
      useFavoritesStore.getState().clear();
      useCartStore.getState().clear();
    }
  }, []);

  return <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}
