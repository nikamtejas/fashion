"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useClickOutside } from "@/lib/useClickOutside";

interface AppNotification {
  _id: string;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [unread, setUnread] = React.useState(0);

  const lastTopId = React.useRef<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const data = await apiFetch<{ notifications: AppNotification[]; unread: number }>("/api/notifications");
      setItems(data.notifications);
      setUnread(data.unread);

      // PWA push-style behavior: surface newly arrived order updates as
      // browser notifications via the service worker (when permitted).
      const top = data.notifications[0];
      if (top && !top.read && lastTopId.current && top._id !== lastTopId.current && Notification?.permission === "granted") {
        navigator.serviceWorker?.ready
          .then((reg) =>
            reg.active?.postMessage({ type: "SHOW_NOTIFICATION", title: top.title, body: top.body, link: top.link })
          )
          .catch(() => {});
      }
      if (top) lastTopId.current = top._id;
    } catch {
      // signed out or backend unreachable — bell just stays quiet
    }
  }, []);

  React.useEffect(() => {
    if (!user) return;
    // Initial fetch + 60s poll; setState happens in the async callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [user, load]);

  const panelRef = useClickOutside<HTMLDivElement>(open, () => setOpen(false));

  if (!user) return null;

  async function openPanel() {
    setOpen((v) => !v);
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    if (!open && unread > 0) {
      await apiFetch("/api/notifications/read-all", { method: "POST" }).catch(() => {});
      setUnread(0);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={openPanel}
        aria-label="Notifications"
        className="relative rounded-full p-2 text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-sienna text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            // Same viewport-clamping fix as SearchBar — see comment there.
            className="fixed inset-x-4 top-16 z-40 rounded-2xl border border-border bg-surface p-2 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-80"
          >
            <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-foreground/50">Notifications</p>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 && <p className="px-3 py-6 text-center text-xs text-foreground/40">Nothing yet.</p>}
              {items.map((n) => (
                <Link
                  key={n._id}
                  href={n.link ?? "#"}
                  onClick={() => setOpen(false)}
                  className={`block rounded-xl px-3 py-2.5 hover:bg-foreground/5 ${n.read ? "" : "bg-accent/5"}`}
                >
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-foreground/60">{n.body}</p>}
                  <p className="mt-1 text-[10px] text-foreground/40">
                    {new Date(n.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
