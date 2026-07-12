"use client";

import * as React from "react";

/** Registers the service worker once on mount. Notification permission is
 * requested contextually by the notifications bell, not on page load. */
export function PwaSetup() {
  React.useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failing (e.g. unsupported browser) is non-fatal.
      });
    }
  }, []);

  return null;
}
