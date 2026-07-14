"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/api";

interface Suggestion {
  name: string;
  slug: string;
  price: number;
  image: string | null;
}

export function SearchBar() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Suggestion[]>([]);
  const [loading, setLoading] = React.useState(false);

  const trimmedQuery = query.trim();

  React.useEffect(() => {
    if (trimmedQuery.length < 2) return;
    // Debounced fetch synced to `trimmedQuery` changes — this is the
    // documented data-fetching-effect pattern, not a derivable value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/search/suggest?q=${encodeURIComponent(trimmedQuery)}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [trimmedQuery]);

  const visibleResults = trimmedQuery.length < 2 ? [] : results;

  return (
    <div className="relative">
      <button
        aria-label="Search"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full p-1.5 text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground sm:p-2"
      >
        {open ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            // Anchored to this trigger's own small container, which can sit
            // anywhere in the icon row — a fixed w-80 panel positioned via
            // `right-0` off a non-edge trigger can run off either side of a
            // phone viewport. Below sm, pin it to the viewport instead;
            // restore the original trigger-anchored layout from sm up.
            className="fixed inset-x-4 top-16 z-40 rounded-2xl border border-border bg-surface p-3 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-80"
          >
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for products…"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <div className={cn("mt-2 max-h-80 overflow-y-auto", visibleResults.length === 0 && !loading && "hidden")}>
              {loading && <p className="px-2 py-3 text-xs text-foreground/50">Searching…</p>}
              {!loading &&
                visibleResults.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/products/${r.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-foreground/5"
                  >
                    <div className="relative h-10 w-10 overflow-hidden rounded-md bg-foreground/5">
                      {r.image && <Image src={r.image} alt={r.name} fill className="object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{r.name}</p>
                      <p className="text-xs text-foreground/50">₹{r.price.toLocaleString("en-IN")}</p>
                    </div>
                  </Link>
                ))}
            </div>
            {!loading && trimmedQuery.length >= 2 && visibleResults.length === 0 && (
              <p className="px-2 py-3 text-xs text-foreground/50">No products found for &ldquo;{query}&rdquo;</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
