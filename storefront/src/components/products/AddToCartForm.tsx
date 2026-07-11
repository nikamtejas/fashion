"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import type { Product } from "@/lib/products";
import { ApiRequestError } from "@/lib/api";

export function AddToCartForm({
  product,
  color,
  onColorChange,
}: {
  product: Product;
  color: string | null;
  onColorChange: (color: string) => void;
}) {
  const { user } = useAuth();
  const { addItem } = useCart();
  const router = useRouter();
  const pathname = usePathname();

  const sizes = Array.from(new Set(product.variants.map((v) => v.size))).filter(Boolean);
  const colors = Array.from(new Set(product.variants.map((v) => v.color))).filter(Boolean);
  const hasVariants = product.variants.length > 0;

  const [size, setSize] = useState<string | null>(sizes[0] ?? null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedVariant = hasVariants
    ? product.variants.find((v) => v.size === size && v.color === color)
    : undefined;

  const availableStock = hasVariants ? (selectedVariant?.stock ?? 0) : product.stock;
  const canAdd = hasVariants ? Boolean(selectedVariant) && availableStock > 0 : availableStock > 0;

  async function handleAddToCart() {
    setError(null);
    setSuccess(false);

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (hasVariants && !selectedVariant) {
      setError("Please select a size and color.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addItem({ productId: product.id, variantSku: selectedVariant?.sku, qty });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to add to cart");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {sizes.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">Size</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  size === s
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-black/15 dark:border-white/20"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {colors.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Color</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onColorChange(c)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  color === c
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-black/15 dark:border-white/20"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasVariants && !selectedVariant && (
        <p className="mt-3 text-sm text-black/50 dark:text-white/50">This combination isn&apos;t available.</p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <div className="flex items-center rounded-full border border-black/15 dark:border-white/20">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex h-10 w-10 items-center justify-center text-lg"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-8 text-center text-sm">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(Math.max(availableStock, 1), q + 1))}
            className="flex h-10 w-10 items-center justify-center text-lg"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <p className="text-sm text-black/60 dark:text-white/60">
          {availableStock > 0 ? `${availableStock} in stock` : "Out of stock"}
        </p>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-green-700 dark:text-green-400">Added to cart.</p>}

      <button
        type="button"
        onClick={handleAddToCart}
        disabled={isSubmitting || !canAdd}
        className="mt-4 flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-black text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black sm:w-auto sm:px-8"
      >
        {isSubmitting ? "Adding…" : "Add to cart"}
      </button>
    </div>
  );
}
