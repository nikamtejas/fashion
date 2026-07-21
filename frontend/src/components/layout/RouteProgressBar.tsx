"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Below this, most navigations in this app resolve (static pages) — never
// showing the bar at all for them avoids a one-frame flash that would read
// as jittery rather than premium. Only genuinely slow navigations (the
// Atlas-backed dynamic routes) end up crossing this threshold.
const SHOW_DELAY_MS = 150;
const TRICKLE_MS = 200;

function RouteProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = React.useState(0);
  const [visible, setVisible] = React.useState(false);

  // Timer/flag bookkeeping lives in a ref, not state — none of it should
  // itself trigger a render; only `progress`/`visible` do.
  const timers = React.useRef({
    navigating: false,
    shown: false,
    showTimer: null as ReturnType<typeof setTimeout> | null,
    trickleTimer: null as ReturnType<typeof setInterval> | null,
    hideTimer: null as ReturnType<typeof setTimeout> | null,
  });

  const clearTimers = React.useCallback(() => {
    const t = timers.current;
    if (t.showTimer) clearTimeout(t.showTimer);
    if (t.trickleTimer) clearInterval(t.trickleTimer);
    if (t.hideTimer) clearTimeout(t.hideTimer);
    t.showTimer = null;
    t.trickleTimer = null;
    t.hideTimer = null;
  }, []);

  const start = React.useCallback(() => {
    const t = timers.current;
    if (t.navigating) return;
    t.navigating = true;
    t.shown = false;
    t.showTimer = setTimeout(() => {
      t.shown = true;
      setVisible(true);
      setProgress(20);
      // Trickles toward — never reaching — 88%, so it always visibly keeps
      // moving for however long the real navigation takes, then the actual
      // pathname-change effect below snaps it to 100 and fades it out.
      t.trickleTimer = setInterval(() => {
        setProgress((p) => (p >= 88 ? p : p + (88 - p) * 0.15));
      }, TRICKLE_MS);
    }, SHOW_DELAY_MS);
  }, []);

  const finish = React.useCallback(() => {
    const t = timers.current;
    if (!t.navigating) return;
    t.navigating = false;
    const wasShown = t.shown;
    clearTimers();
    if (!wasShown) return; // completed inside the show-delay — never flashed, nothing to animate out
    setProgress(100);
    t.hideTimer = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 200);
  }, [clearTimers]);

  // The route having actually changed is the one reliable "navigation is
  // done" signal in the App Router (no router.events to hook here).
  React.useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Starts the bar the moment a same-origin link is clicked — before
  // Next.js's own transition begins, so a slow dynamic route (Atlas-backed,
  // in dev especially) gets a visible bar instead of a click that appears
  // to do nothing for a second or more.
  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // Cross-origin (Google OAuth, invoice download, etc.) truly leaves the
      // app — a bar that starts and never finishes would just sit there.
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [start]);

  React.useEffect(() => clearTimers, [clearTimers]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      {/* scaleX (not width) — a compositor-only transform, so every trickle
          tick during a slow navigation costs the GPU a repaint, never a
          full-page layout recalculation the way animating `width` would. */}
      <div
        className="h-full w-full origin-left bg-accent transition-transform duration-300 ease-out"
        style={{ transform: `scaleX(${progress / 100})`, boxShadow: "0 0 8px var(--color-accent), 0 0 3px var(--color-accent)" }}
      />
    </div>
  );
}

export function RouteProgressBar() {
  return (
    <React.Suspense fallback={null}>
      <RouteProgressBarInner />
    </React.Suspense>
  );
}
