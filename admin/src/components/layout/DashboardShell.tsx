"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/orders", label: "Orders" },
  { href: "/coupons", label: "Coupons" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-black focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      {/* Mobile top bar */}
      <div className="flex h-14 items-center justify-between border-b border-black/10 px-4 dark:border-white/10 md:hidden">
        <button
          type="button"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {menuOpen ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            )}
          </svg>
        </button>
        <span className="text-sm font-semibold tracking-tight">FASHION.CO Admin</span>
        <div className="h-10 w-10" aria-hidden="true" />
      </div>

      {/* Sidebar (drawer on mobile, static on desktop) */}
      <aside
        className={`${
          menuOpen ? "block" : "hidden"
        } border-b border-black/10 dark:border-white/10 md:block md:w-60 md:shrink-0 md:border-b-0 md:border-r`}
      >
        <div className="hidden h-14 items-center px-6 text-sm font-semibold tracking-tight md:flex">
          FASHION.CO Admin
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                  active
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-black/10 p-3 dark:border-white/10">
          <p className="truncate px-3 text-xs text-black/50 dark:text-white/50">{user?.email}</p>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-1 w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
          >
            Log out
          </button>
        </div>
      </aside>

      <main id="dashboard-main" className="flex-1 px-4 py-6 sm:px-6 md:px-8">
        {children}
      </main>
    </div>
  );
}
