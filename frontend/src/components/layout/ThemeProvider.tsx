"use client";

import * as React from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>("light");

  React.useEffect(() => {
    // Reads browser-only state (localStorage/matchMedia) unavailable during SSR,
    // so this can't be a useState initializer — must run post-mount.
    // localStorage can throw (Safari private browsing, an extension/policy
    // blocking storage) — this wraps the whole app, and there's no error
    // boundary anywhere in it, so an unguarded throw here white-screens the
    // entire site over what should just be "theme preference isn't saved."
    let preferred: Theme = "light";
    try {
      const stored = localStorage.getItem("luxeloom-theme") as Theme | null;
      preferred = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    } catch {
      preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(preferred);
    document.documentElement.classList.toggle("dark", preferred === "dark");
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem("luxeloom-theme", next);
      } catch {
        // Storage blocked — the toggle still works for this session, it just won't persist.
      }
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
