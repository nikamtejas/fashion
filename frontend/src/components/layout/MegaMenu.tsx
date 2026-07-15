"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SHOP_SUBCATEGORIES, SHOP_CATEGORY_LABELS } from "@/lib/shopCategories";

const MENU: Record<string, { label: string; items: { label: string; href: string }[] }> = Object.fromEntries(
  Object.entries(SHOP_SUBCATEGORIES).map(([category, subs]) => [
    category,
    {
      label: SHOP_CATEGORY_LABELS[category],
      items: subs.map((s) => ({ label: s.label, href: `/shop?category=${category}&sub=${s.value}` })),
    },
  ])
);

export function MegaMenu() {
  const [active, setActive] = React.useState<string | null>(null);
  const pathname = usePathname();

  // Belt-and-braces close on navigation — click handlers on each Link cover
  // the common case, but this catches a full page-to-page navigation
  // without the mouse leaving the nav (e.g. a tap that doesn't move focus).
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(null);
  }, [pathname]);

  return (
    <nav className="hidden items-center gap-8 md:flex" onMouseLeave={() => setActive(null)}>
      {Object.entries(MENU).map(([key, section]) => (
        <div key={key} className="relative" onMouseEnter={() => setActive(key)}>
          <Link
            href={`/shop?category=${key}`}
            onClick={() => setActive(null)}
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
                    onClick={() => setActive(null)}
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
