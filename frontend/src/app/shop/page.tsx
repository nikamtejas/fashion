import { Suspense } from "react";
import { ShopClient } from "./ShopClient";
import { API_URL } from "@/lib/api";
import type { ShopProduct } from "@/components/shop/types";

interface InitialProducts {
  products: ShopProduct[];
  hasMore: boolean;
}

// Matches ShopClient's own default fetch (sort=new, page=1, limit=12) so the
// client never re-fetches page 1 on mount — this removes a full round trip
// (download JS, hydrate, then fetch) that used to sit in front of every shop
// page visit.
async function getInitialProducts(category?: string): Promise<InitialProducts> {
  try {
    const params = new URLSearchParams({ sort: "new", page: "1", limit: "12" });
    if (category) params.set("category", category);
    const res = await fetch(`${API_URL}/api/products?${params.toString()}`, { next: { revalidate: 30 } });
    if (!res.ok) return { products: [], hasMore: false };
    const data = await res.json();
    return { products: data.products ?? [], hasMore: Boolean(data.hasMore) };
  } catch {
    return { products: [], hasMore: false };
  }
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const initial = await getInitialProducts(category);

  return (
    <Suspense fallback={null}>
      <ShopClient initialProducts={initial.products} initialHasMore={initial.hasMore} initialCategory={category ?? null} />
    </Suspense>
  );
}
