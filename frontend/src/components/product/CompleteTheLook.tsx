"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";
import { ProductCard } from "@/components/shop/ProductCard";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ShopProduct } from "@/components/shop/types";

export function CompleteTheLook({ slug }: { slug: string }) {
  const [products, setProducts] = React.useState<ShopProduct[] | null>(null);

  React.useEffect(() => {
    // Reset to the loading skeleton when the slug changes; setState in the
    // async callbacks below is the real fetch completion.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProducts(null);
    apiFetch<{ products: ShopProduct[] }>(`/api/products/${slug}/complete-the-look`)
      .then((data) => setProducts(data.products))
      .catch(() => setProducts([]));
  }, [slug]);

  // null = still resolving — reserve space with a skeleton instead of the
  // section popping in and shoving everything below (reviews, footer) down.
  if (products === null) {
    return (
      <section className="mt-20">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-3 h-7 w-56" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full" />
          ))}
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="mt-20">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-sienna">AI Styling</p>
      <h2 className="font-display mt-2 text-2xl">Complete the look</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
