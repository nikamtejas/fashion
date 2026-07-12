"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ProductCard } from "@/components/shop/ProductCard";
import { FilterSidebar, type ShopFilters } from "@/components/shop/FilterSidebar";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ShopProduct } from "@/components/shop/types";

interface ProductsResponse {
  products: ShopProduct[];
  page: number;
  hasMore: boolean;
}

export function ShopClient() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = React.useState<ShopFilters>({
    category: searchParams.get("category"),
    sizes: [],
    colors: [],
    minPrice: "",
    maxPrice: "",
  });
  const [sort, setSort] = React.useState("new");
  const [products, setProducts] = React.useState<ShopProduct[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const fetchPage = React.useCallback(
    async (pageNum: number, replace: boolean) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.category) params.set("category", filters.category);
      if (filters.sizes.length) params.set("size", filters.sizes.join(","));
      if (filters.colors.length) params.set("color", filters.colors.join(","));
      if (filters.minPrice) params.set("minPrice", filters.minPrice);
      if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
      params.set("sort", sort);
      params.set("page", String(pageNum));
      params.set("limit", "12");

      try {
        const data = await apiFetch<ProductsResponse>(`/api/products?${params.toString()}`);
        setProducts((prev) => (replace ? data.products : [...prev, ...data.products]));
        setHasMore(data.hasMore);
        setPage(pageNum);
      } finally {
        setLoading(false);
      }
    },
    [filters, sort]
  );

  React.useEffect(() => {
    // fetchPage's identity changes whenever filters/sort change (it's a
    // useCallback over them), so depending on it alone re-runs this on
    // every filter change — data-fetching-effect pattern; setState happens
    // inside the async callback, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPage(1, true);
  }, [fetchPage]);

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchPage(page + 1, false);
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchPage, hasMore, loading, page]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Shop</h1>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-10 rounded-full border border-border bg-surface px-4 text-sm"
        >
          <option value="new">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

      <div className="mt-8 flex flex-col gap-8 sm:flex-row">
        <FilterSidebar filters={filters} onChange={setFilters} />

        <div className="flex-1">
          {products.length === 0 && !loading && (
            <p className="py-20 text-center text-sm text-foreground/50">No products match these filters.</p>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 [&>*:nth-child(7n+1)]:sm:col-span-2 [&>*:nth-child(7n+1)]:sm:row-span-2">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
            {loading &&
              Array.from({ length: 8 }).map((_, i) => <Skeleton key={`s-${i}`} className="aspect-[3/4] w-full" />)}
          </div>

          <div ref={sentinelRef} className="h-1" />
        </div>
      </div>
    </div>
  );
}
