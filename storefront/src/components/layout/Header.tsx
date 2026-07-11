"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useCart } from "@/context/CartContext";

const NAV_LINKS = [
  { href: "/", label: "Shop" },
  { href: "/", label: "New In" },
  { href: "/", label: "Sale" },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isLoading, logout } = useAuth();
  const { favoriteIds } = useFavorites();
  const { itemCount } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-black/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <button
          type="button"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full md:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="sr-only">Toggle menu</span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {menuOpen ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>

        <Link href="/" className="text-lg font-semibold tracking-tight sm:text-xl">
          FASHION.CO
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-8 text-sm font-medium md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} href={link.href} className="hover:opacity-70">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <IconButton label="Wishlist" href="/account/wishlist" count={favoriteIds.size}>
            <path
              d="M12 20s-7-4.35-9.5-8.5C.7 8.1 2.3 4.5 6 4.5c2 0 3.4 1.1 4 2.3.6-1.2 2-2.3 4-2.3 3.7 0 5.3 3.6 3.5 7-2.5 4.15-9.5 8.5-9.5 8.5z"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinejoin="round"
            />
          </IconButton>
          <IconButton label="Cart" href="/cart" count={itemCount}>
            <path
              d="M6 8h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinejoin="round"
            />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </IconButton>
          {!isLoading && user ? (
            <button
              type="button"
              onClick={() => logout()}
              className="hidden rounded-full border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10 sm:block"
            >
              Log out
            </button>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-full border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10 sm:block"
            >
              Log in
            </Link>
          )}
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-black/10 px-4 pb-4 pt-2 dark:border-white/10 md:hidden">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="block rounded-lg px-3 py-2.5 text-base font-medium hover:bg-black/5 dark:hover:bg-white/10"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="mt-2 border-t border-black/10 pt-2 dark:border-white/10">
              {!isLoading && user ? (
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                  }}
                  className="block w-full rounded-lg px-3 py-2.5 text-left text-base font-medium hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Log out
                </button>
              ) : (
                <Link
                  href="/login"
                  className="block rounded-lg px-3 py-2.5 text-base font-medium hover:bg-black/5 dark:hover:bg-white/10"
                  onClick={() => setMenuOpen(false)}
                >
                  Log in
                </Link>
              )}
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

function IconButton({
  label,
  href,
  count,
  children,
}: {
  label: string;
  href: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={count ? `${label} (${count})` : label}
      className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        {children}
      </svg>
      {Boolean(count) && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-medium text-white dark:bg-white dark:text-black">
          {count}
        </span>
      )}
    </Link>
  );
}
