"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, ShoppingBag, Menu, X } from "lucide-react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { MegaMenu } from "@/components/layout/MegaMenu";
import { SearchBar } from "@/components/layout/SearchBar";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { useCartStore } from "@/store/cartStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { cn } from "@/lib/utils";

function IconCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-sienna text-[10px] font-semibold text-white">
      {count}
    </span>
  );
}

export function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const cartCount = useCartStore((s) => s.count);
  const openCartDrawer = useCartStore((s) => s.openDrawer);
  const favoritesCount = useFavoritesStore((s) => s.count);

  useMotionValueEvent(scrollY, "change", (latest) => setScrolled(latest > 12));

  return (
    <motion.header
      className={cn(
        "sticky top-0 z-30 border-b transition-colors",
        scrolled
          ? "border-border bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60"
          : "border-transparent bg-background"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-1 px-4 sm:h-20 sm:gap-2 sm:px-6 lg:px-8">
        <button
          className="shrink-0 rounded-full p-1.5 hover:bg-foreground/5 sm:p-2 md:hidden"
          aria-label="Open menu"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Logo is the one element allowed to shrink/truncate — every other
            element here is a tap target and must stay full-size. */}
        <Link href="/" className="min-w-0 shrink truncate font-display text-lg tracking-tight sm:text-2xl">
          LUXELOOM
        </Link>

        <MegaMenu />

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <SearchBar />
          <Link
            href="/favorites"
            aria-label="Favorites"
            className="relative rounded-full p-1.5 text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground sm:p-2"
          >
            <Heart className="h-5 w-5" />
            <IconCount count={favoritesCount} />
          </Link>
          <button
            onClick={openCartDrawer}
            aria-label="Cart"
            className="relative rounded-full p-1.5 text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground sm:p-2"
          >
            <ShoppingBag className="h-5 w-5" />
            <IconCount count={cartCount} />
          </button>
          <NotificationsBell />
          <ProfileMenu />
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {["Men", "Women", "Accessories", "Footwear"].map((label) => (
              <Link
                key={label}
                href={`/shop?category=${label.toLowerCase()}`}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium uppercase tracking-wide text-foreground/80"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </motion.header>
  );
}
