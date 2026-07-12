"use client";

import * as React from "react";
import Image from "next/image";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useCartStore } from "@/store/cartStore";
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
  const [size, setSize] = React.useState<string | null>(null);
  const bumpCart = useCartStore((s) => s.setCount);
  const cartCount = useCartStore((s) => s.count);

  function handleAdd() {
    if (product.sizes.length > 0 && !size) {
      toast({ title: "Pick a size first", variant: "error" });
      return;
    }
    // Full persisted cart lands in Milestone 4 — for now this just reflects
    // in the navbar badge so quick-add feels real during this milestone.
    bumpCart(cartCount + 1);
    toast({ title: "Added to bag", description: product.name, variant: "success" });
    onOpenChange(false);
    setSize(null);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title="Quick add">
      <div className="flex gap-4">
        <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-foreground/5">
          {product.image && <Image src={product.image} alt={product.name} fill className="object-cover" />}
        </div>
        <div>
          <p className="text-sm font-medium">{product.name}</p>
          <p className="mt-1 text-sm text-foreground/60">₹{product.price.toLocaleString("en-IN")}</p>
        </div>
      </div>

      {product.sizes.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Size</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`h-10 min-w-10 rounded-full border px-3 text-sm transition-colors ${
                  size === s ? "border-ink bg-ink text-ivory dark:border-ivory dark:bg-ivory dark:text-ink" : "border-border"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button className="mt-8 w-full" size="lg" onClick={handleAdd} disabled={!product.inStock}>
        {product.inStock ? "Add to bag" : "Out of stock"}
      </Button>
    </Drawer>
  );
}
