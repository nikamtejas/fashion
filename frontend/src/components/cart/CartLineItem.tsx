"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, Bookmark } from "lucide-react";
import { useCartStore, type CartLine } from "@/store/cartStore";
import { useToast } from "@/components/ui/Toast";

export function CartLineItem({ line, compact }: { line: CartLine; compact?: boolean }) {
  const { toast } = useToast();
  const updateItem = useCartStore((s) => s.updateItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const saveForLater = useCartStore((s) => s.saveForLater);
  const [busy, setBusy] = React.useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast({ title: "Couldn't update bag", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-3 py-4">
      <Link href={`/products/${line.slug}`} className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-foreground/5">
        {line.image && <Image src={line.image} alt={line.name} fill sizes="80px" className="object-cover" />}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/products/${line.slug}`} className="text-sm font-medium hover:underline">
            {line.name}
          </Link>
          <p className="shrink-0 text-sm tabular-nums">₹{line.lineTotal.toLocaleString("en-IN")}</p>
        </div>
        <p className="mt-0.5 text-xs text-foreground/50">{line.color}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={line.sku}
            disabled={busy}
            onChange={(e) => run(() => updateItem(line.sku, { newSku: e.target.value }))}
            className="h-8 rounded-lg border border-border bg-surface px-2 text-xs"
            aria-label="Size"
          >
            {line.availableSizes.map((s) => (
              <option key={s.sku} value={s.sku} disabled={s.stock === 0 && s.sku !== line.sku}>
                {s.size}
                {s.stock === 0 ? " — out of stock" : ""}
              </option>
            ))}
          </select>

          <div className="flex items-center rounded-lg border border-border">
            <button
              disabled={busy}
              aria-label="Decrease quantity"
              onClick={() => run(() => updateItem(line.sku, { qty: line.qty - 1 }))}
              className="p-1.5 text-foreground/60 hover:text-foreground disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-7 text-center text-xs tabular-nums">{line.qty}</span>
            <button
              disabled={busy || line.qty >= line.stock}
              aria-label="Increase quantity"
              onClick={() => run(() => updateItem(line.sku, { qty: line.qty + 1 }))}
              className="p-1.5 text-foreground/60 hover:text-foreground disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {line.stock <= 5 && <span className="text-[10px] text-amber-600">Only {line.stock} left</span>}
        </div>

        {!compact && (
          <div className="mt-2 flex gap-3">
            <button
              disabled={busy}
              onClick={() => run(() => saveForLater(line.sku))}
              className="flex items-center gap-1 text-xs text-foreground/50 hover:text-foreground"
            >
              <Bookmark className="h-3 w-3" /> Save for later
            </button>
            <button
              disabled={busy}
              onClick={() => run(() => removeItem(line.sku))}
              className="flex items-center gap-1 text-xs text-foreground/50 hover:text-red-600"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
