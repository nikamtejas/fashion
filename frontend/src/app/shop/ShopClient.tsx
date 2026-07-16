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

export function ShopClient({
  initialProducts = [],
  initialHasMore = true,
  initialCategory = null,
  initialSub = null,
}: {
  initialProducts?: ShopProduct[];
  initialHasMore?: boolean;
  initialCategory?: string | null;
  initialSub?: string | null;
}) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = React.useState<ShopFilters>({
    category: searchParams.get("category"),
    sub: searchParams.get("sub"),
    sizes: [],
    colors: [],
    minPrice: "",
    maxPrice: "",
  });
  const [sort, setSort] = React.useState("new");
  const [products, setProducts] = React.useState<ShopProduct[]>(initialProducts);
  const [loading, setLoading] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  // Server already fetched page 1 for this exact category/sub/sort/page combo —
  // skip the redundant client-side re-fetch on mount.
  const skipInitialFetch = React.useRef(
    initialProducts.length > 0 && searchParams.get("category") === initialCategory && searchParams.get("sub") === initialSub
  );
  // Navigating here from elsewhere (e.g. the MegaMenu) while already on
  // /shop doesn't remount this component, so `filters` — only ever read
  // from the URL once, on mount — goes stale until a hard refresh. Re-sync
  // it whenever the URL's own category/sub change from outside this page
  // (skip the first run: the state above already matches on mount).
  const isFirstUrlSync = React.useRef(true);
  React.useEffect(() => {
    if (isFirstUrlSync.current) {
      isFirstUrlSync.current = false;
      return;
    }
    setFilters({
      category: searchParams.get("category"),
      sub: searchParams.get("sub"),
      sizes: [],
      colors: [],
      minPrice: "",
      maxPrice: "",
    });
  }, [searchParams]);

  // React's `loading` state is async/batched, so it can't reliably gate
  // against two fetches firing before the first one's setState has
  // committed (IntersectionObserver re-fires its callback with the current
  // intersection state every time it's re-attached, which happened on every
  // page/hasMore/loading change here — a fresh page could get appended
  // twice, duplicating every item on it, and React keys on product id, so
  // that surfaced as a duplicate-key warning). A ref is synchronous and
  // closes that race regardless of render timing.
  const fetchingRef = React.useRef(false);
  const pageRef = React.useRef(1);
  const hasMoreRef = React.useRef(initialHasMore);

  const fetchPage = React.useCallback(
    async (pageNum: number, replace: boolean) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.category) params.set("category", filters.category);
      if (filters.sub) params.set("sub", filters.sub);
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
        pageRef.current = pageNum;
        hasMoreRef.current = data.hasMore;
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    },
    [filters, sort]
  );

  React.useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    // fetchPage's identity changes whenever filters/sort change (it's a
    // useCallback over them), so depending on it alone re-runs this on
    // every filter change — data-fetching-effect pattern; setState happens
    // inside the async callback, not synchronously in the effect body.
    fetchPage(1, true);
  }, [fetchPage]);

  // A single observer for the component's lifetime — reading hasMore/page
  // via refs instead of depending on that state means it's never torn down
  // and re-attached on every fetch, which used to re-trigger its callback
  // (a freshly-observed element reports its current intersection state
  // immediately) as a second, racing fetch of the same page.
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && !fetchingRef.current) {
          fetchPage(pageRef.current + 1, false);
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchPage]);

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
