"use client";

import { useEffect, useState } from "react";
import { listFavorites } from "@/lib/favorites";
import { ProductCard } from "@/components/products/ProductCard";
import type { Product } from "@/lib/products";
import { ApiRequestError } from "@/lib/api";

export default function WishlistPage() {
  const [items, setItems] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listFavorites()
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : "Failed to load wishlist"));
  }, []);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 h-6 w-32 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[3/4] w-full animate-pulse rounded-lg bg-black/10 dark:bg-white/10" />
              <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-black/10 dark:bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Your wishlist is empty</h1>
        <p className="mt-3 max-w-sm text-black/60 dark:text-white/60">
          Tap the heart icon on any product to save it here.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 text-xl font-semibold tracking-tight sm:text-2xl">Your wishlist</h1>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
