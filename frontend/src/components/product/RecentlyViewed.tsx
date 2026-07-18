"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";
import { ProductCard } from "@/components/shop/ProductCard";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ShopProduct } from "@/components/shop/types";

const KEY = "luxeloom-recently-viewed";
const MAX = 8;

export function recordView(slug: string) {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    const next = [slug, ...list.filter((s) => s !== slug)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — the rail just won't populate
  }
}

export function RecentlyViewedRail({ excludeSlug }: { excludeSlug?: string }) {
  const [products, setProducts] = React.useState<ShopProduct[] | null>(null);

  React.useEffect(() => {
    try {
      const slugs: string[] = JSON.parse(localStorage.getItem(KEY) ?? "[]").filter((s: string) => s !== excludeSlug);
      if (slugs.length === 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setProducts([]);
        return;
      }
      apiFetch<{ products: ShopProduct[] }>(`/api/products?slugs=${slugs.join(",")}&limit=${MAX}`)
        .then((d) => {
          // Preserve the local view order (the API returns its own sort).
          const bySlug = new Map(d.products.map((p) => [p.slug, p]));
          setProducts(slugs.map((s) => bySlug.get(s)).filter(Boolean) as ShopProduct[]);
        })
        // This is a separate promise chain from the surrounding try/catch
        // (which only covers the synchronous JSON.parse above), so a
        // rejection here previously left `products` stuck at null forever
        // — the rail's skeleton placeholder never resolved into anything.
        .catch(() => setProducts([]));
    } catch {
      setProducts([]);
    }
  }, [excludeSlug]);

  // null = still resolving — reserve the rail's space with a skeleton
  // instead of popping the whole section in once the fetch lands (this used
  // to shove everything below it, including the footer, down the page).
  if (products === null) {
    return (
      <section className="mt-20">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-48" />
        <div className="mt-6 flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-52 shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="mt-20">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-sienna">Keep browsing</p>
      <h2 className="font-display mt-2 text-2xl">Recently viewed</h2>
      <div className="mt-6 flex snap-x gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((p) => (
          <div key={p.id} className="w-52 shrink-0 snap-start">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
