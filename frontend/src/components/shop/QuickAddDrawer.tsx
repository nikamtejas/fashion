"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { API_URL } from "@/lib/api";
import { useCartStore } from "@/store/cartStore";
import { useAuth } from "@/context/AuthContext";
import type { ShopProduct } from "./types";

export function QuickAddDrawer({
  product,
  open,
  onOpenChange,
}: {
  product: ShopProduct;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [sku, setSku] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [sizes, setSizes] = React.useState<{ size: string; sku: string; stock: number }[]>([]);

  // The card payload only carries size names — fetch real SKUs when opened.
  React.useEffect(() => {
    if (!open) return;
    fetch(`${API_URL}/api/products/${product.slug}`)
      .then((r) => r.json())
      .then((data) => {
        const variants = (data.product?.variants ?? []) as { size: string; sku: string; stock: number; color: string }[];
        const firstColor = variants[0]?.color;
        setSizes(variants.filter((v) => v.color === firstColor).map((v) => ({ size: v.size, sku: v.sku, stock: v.stock })));
      })
      .catch(() => setSizes([]));
  }, [open, product.slug]);

  async function handleAdd() {
    if (!user) {
      router.push("/login?callbackUrl=/shop");
      return;
    }
    if (sizes.length > 0 && !sku) {
      toast({ title: "Pick a size first", variant: "error" });
      return;
    }
    setAdding(true);
    try {
      await addItem(product.id, sku ?? sizes[0]?.sku ?? "");
      onOpenChange(false);
      setSku(null);
    } catch (err) {
      toast({ title: "Couldn't add to bag", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setAdding(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title="Quick add">
      <div className="flex gap-4">
        <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-foreground/5">
          {product.image && <Image src={product.image} alt={product.name} fill sizes="80px" className="object-cover" />}
        </div>
        <div>
          <p className="text-sm font-medium">{product.name}</p>
          <p className="mt-1 text-sm text-foreground/60">₹{product.price.toLocaleString("en-IN")}</p>
        </div>
      </div>

      {sizes.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Size</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s.sku}
                onClick={() => setSku(s.sku)}
                disabled={s.stock === 0}
                className={`h-10 min-w-10 rounded-full border px-3 text-sm transition-colors disabled:opacity-40 ${
                  sku === s.sku ? "border-ink bg-ink text-ivory dark:border-ivory dark:bg-ivory dark:text-ink" : "border-border"
                }`}
              >
                {s.size}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button className="mt-8 w-full" size="lg" onClick={handleAdd} disabled={!product.inStock || adding}>
        {adding ? "Adding…" : product.inStock ? "Add to bag" : "Out of stock"}
      </Button>
    </Drawer>
  );
}
