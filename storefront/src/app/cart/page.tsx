"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { withCloudinaryTransform } from "@/lib/cloudinary";
import { ApiRequestError } from "@/lib/api";

export default function CartPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { cart, isLoading: cartLoading, updateItem, removeItem, applyCoupon, removeCoupon } = useCart();
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  if (authLoading || (user && cartLoading)) {
    return (
      <div className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 h-6 w-32 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="h-40 w-full animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Your cart</h1>
        <p className="mt-3 max-w-sm text-black/60 dark:text-white/60">Log in to see your cart.</p>
        <Link
          href="/login?next=/cart"
          className="mt-6 rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Your cart is empty</h1>
        <p className="mt-3 max-w-sm text-black/60 dark:text-white/60">
          Browse the catalog and add something you like.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Shop now
        </Link>
      </div>
    );
  }

  async function handleApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCouponError(null);
    setIsApplying(true);
    try {
      await applyCoupon(couponInput.trim());
      setCouponInput("");
    } catch (err) {
      setCouponError(err instanceof ApiRequestError ? err.message : "Failed to apply coupon");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 text-xl font-semibold tracking-tight sm:text-2xl">Your cart</h1>

      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
          {cart.items.map((item) => (
            <div key={item.itemId} className="flex gap-4 py-4">
              <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-black/5 dark:bg-white/5">
                {item.imageUrl && (
                  <Image
                    src={withCloudinaryTransform(item.imageUrl, "f_auto,q_auto,w_200")}
                    alt={item.productName}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/products/${item.productSlug}`} className="text-sm font-medium hover:underline">
                      {item.productName}
                    </Link>
                    {(item.size || item.color) && (
                      <p className="mt-0.5 text-xs text-black/60 dark:text-white/60">
                        {[item.size, item.color].filter(Boolean).join(" / ")}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-medium">₹{item.lineTotal.toFixed(2)}</p>
                </div>

                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center rounded-full border border-black/15 dark:border-white/20">
                    <button
                      type="button"
                      onClick={() => updateItem(item.itemId, Math.max(1, item.qty - 1))}
                      disabled={item.qty <= 1}
                      className="flex h-8 w-8 items-center justify-center text-base disabled:opacity-40"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => updateItem(item.itemId, Math.min(item.availableStock, item.qty + 1))}
                      disabled={item.qty >= item.availableStock}
                      className="flex h-8 w-8 items-center justify-center text-base disabled:opacity-40"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.itemId)}
                    className="text-xs font-medium text-black/50 underline dark:text-white/50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="h-fit rounded-xl border border-black/10 p-5 dark:border-white/10">
          <div className="flex items-center justify-between text-sm">
            <span className="text-black/60 dark:text-white/60">Subtotal</span>
            <span>₹{cart.subtotal.toFixed(2)}</span>
          </div>

          {cart.coupon && (
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-black/60 dark:text-white/60">Coupon ({cart.coupon.code})</span>
              <span className="flex items-center gap-2">
                −₹{cart.discount.toFixed(2)}
                <button
                  type="button"
                  onClick={() => removeCoupon()}
                  className="text-xs font-medium text-black/50 underline dark:text-white/50"
                >
                  Remove
                </button>
              </span>
            </div>
          )}

          <div className="my-3 border-t border-black/10 dark:border-white/10" />

          <div className="flex items-center justify-between text-base font-medium">
            <span>Total</span>
            <span>₹{cart.total.toFixed(2)}</span>
          </div>

          {!cart.coupon && (
            <form onSubmit={handleApplyCoupon} className="mt-4 flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Coupon code"
                className="h-10 flex-1 rounded-lg border border-black/15 bg-transparent px-3 text-sm uppercase outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
              />
              <button
                type="submit"
                disabled={isApplying || !couponInput.trim()}
                className="h-10 rounded-lg border border-black/15 px-4 text-sm font-medium disabled:opacity-50 dark:border-white/20"
              >
                {isApplying ? "…" : "Apply"}
              </button>
            </form>
          )}
          {couponError && <p className="mt-2 text-xs text-red-600">{couponError}</p>}

          <Link
            href="/checkout"
            className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-black text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Proceed to checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
