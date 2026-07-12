"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";
import { ProductCard } from "@/components/shop/ProductCard";
import type { ShopProduct } from "@/components/shop/types";

export function CompleteTheLook({ slug }: { slug: string }) {
  const [products, setProducts] = React.useState<ShopProduct[]>([]);

  React.useEffect(() => {
    apiFetch<{ products: ShopProduct[] }>(`/api/products/${slug}/complete-the-look`)
      .then((data) => setProducts(data.products))
      .catch(() => setProducts([]));
  }, [slug]);

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
