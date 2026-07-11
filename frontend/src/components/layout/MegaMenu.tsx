"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

const MENU: Record<string, { label: string; items: { label: string; href: string }[] }> = {
  men: {
    label: "Men",
    items: [
      { label: "Shirts", href: "/shop?category=men&sub=shirts" },
      { label: "T-Shirts", href: "/shop?category=men&sub=tshirts" },
      { label: "Trousers", href: "/shop?category=men&sub=trousers" },
      { label: "Jackets", href: "/shop?category=men&sub=jackets" },
    ],
  },
  women: {
    label: "Women",
    items: [
      { label: "Dresses", href: "/shop?category=women&sub=dresses" },
      { label: "Tops", href: "/shop?category=women&sub=tops" },
      { label: "Ethnic Wear", href: "/shop?category=women&sub=ethnic" },
      { label: "Outerwear", href: "/shop?category=women&sub=outerwear" },
    ],
  },
  accessories: {
    label: "Accessories",
    items: [
      { label: "Bags", href: "/shop?category=accessories&sub=bags" },
      { label: "Belts", href: "/shop?category=accessories&sub=belts" },
      { label: "Jewelry", href: "/shop?category=accessories&sub=jewelry" },
      { label: "Scarves", href: "/shop?category=accessories&sub=scarves" },
    ],
  },
  footwear: {
    label: "Footwear",
    items: [
      { label: "Sneakers", href: "/shop?category=footwear&sub=sneakers" },
      { label: "Formal", href: "/shop?category=footwear&sub=formal" },
      { label: "Sandals", href: "/shop?category=footwear&sub=sandals" },
      { label: "Boots", href: "/shop?category=footwear&sub=boots" },
    ],
  },
};

export function MegaMenu() {
  const [active, setActive] = React.useState<string | null>(null);

  return (
    <nav className="hidden items-center gap-8 md:flex" onMouseLeave={() => setActive(null)}>
      {Object.entries(MENU).map(([key, section]) => (
        <div key={key} className="relative" onMouseEnter={() => setActive(key)}>
          <Link
            href={`/shop?category=${key}`}
            className="text-sm font-medium uppercase tracking-wide text-foreground/80 transition-colors hover:text-accent"
          >
            {section.label}
          </Link>
          <AnimatePresence>
            {active === key && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                className="absolute left-1/2 top-full z-40 mt-4 w-56 -translate-x-1/2 rounded-2xl border border-border bg-surface p-3 shadow-2xl"
              >
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-lg px-3 py-2 text-sm text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </nav>
  );
}
