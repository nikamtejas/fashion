"use client";

import * as React from "react";

/** Registers the service worker once on mount. Notification permission is
 * requested contextually by the notifications bell, not on page load. */
export function PwaSetup() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // Dev: an installed worker serves stale unhashed /_next/static chunks,
      // shadowing code changes. Remove any worker + its caches entirely.
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => k.startsWith("luxeloom-") && caches.delete(k)));
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration failing (e.g. unsupported browser) is non-fatal.
    });
  }, []);

  return null;
}
