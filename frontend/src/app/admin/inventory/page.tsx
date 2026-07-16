"use client";

import * as React from "react";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface InventoryProduct {
  id: string;
  name: string;
  slug: string;
  status: string;
  image: string | null;
  variants: { sku: string; size: string; color: string; stock: number }[];
  totalStock: number;
}

export default function AdminInventoryPage() {
  const { toast } = useToast();
  const [q, setQ] = React.useState("");
  const [products, setProducts] = React.useState<InventoryProduct[] | null>(null);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      // Debounced search; setState in the async callback.
       
      apiFetch<{ products: InventoryProduct[] }>(`/api/admin/inventory?q=${encodeURIComponent(q)}`).then((d) =>
        setProducts(d.products)
      );
    }, 200);
    return () => clearTimeout(handle);
  }, [q]);

  async function saveStock(productId: string, sku: string, stock: number) {
    try {
      await apiFetch("/api/admin/inventory/stock", { method: "PATCH", json: { productId, sku, stock } });
      setProducts(
        (prev) =>
          prev?.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  variants: p.variants.map((v) => (v.sku === sku ? { ...v, stock } : v)),
                  totalStock: p.variants.reduce((s, v) => s + (v.sku === sku ? stock : v.stock), 0),
                }
              : p
          ) ?? null
      );
    } catch (err) {
      toast({ title: "Couldn't update stock", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Inventory</h1>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products…"
          className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm sm:w-64"
        />
      </div>

      {products === null && <Skeleton className="mt-6 h-48 w-full" />}

      <div className="mt-6 space-y-4">
        {products?.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-md bg-foreground/5">
                {p.image && <Image src={p.image} alt={p.name} fill sizes="40px" className="object-cover" />}
              </div>
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-foreground/50">
                  {p.status} · {p.totalStock} units total
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {p.variants.map((v) => (
                <label
                  key={v.sku}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-xs",
                    v.stock === 0 ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30" : v.stock < 5 ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" : "border-border"
                  )}
                >
                  <span className="truncate text-foreground/60">
                    {v.size}/{v.color}
                  </span>
                  <input
                    type="number"
                    min={0}
                    defaultValue={v.stock}
                    onBlur={(e) => {
                      const stock = Number(e.target.value);
                      if (stock !== v.stock && stock >= 0) saveStock(p.id, v.sku, stock);
                    }}
                    className="h-7 w-16 rounded-md border border-border bg-background px-1.5 text-right tabular-nums"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
