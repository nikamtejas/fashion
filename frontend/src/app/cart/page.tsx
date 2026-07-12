"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { CartLineItem } from "@/components/cart/CartLineItem";
import { CartSummary } from "@/components/cart/CartSummary";
import { FreeShippingBar } from "@/components/cart/FreeShippingBar";
import { CouponBox } from "@/components/cart/CouponBox";

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const cart = useCartStore((s) => s.cart);
  const loaded = useCartStore((s) => s.loaded);
  const moveToBag = useCartStore((s) => s.moveToBag);
  const removeSaved = useCartStore((s) => s.removeSaved);

  React.useEffect(() => {
    if (!authLoading && !user) router.replace("/login?callbackUrl=/cart");
  }, [authLoading, user, router]);

  React.useEffect(() => {
    if (cart?.droppedCoupon) {
      toast({
        title: `Coupon ${cart.droppedCoupon.code} removed`,
        description: cart.droppedCoupon.reason,
        variant: "error",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.droppedCoupon?.code]);

  if (authLoading || !user || !loaded) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <div className="mt-8 space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl">Your bag</h1>

      {isEmpty ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <ShoppingBag className="h-10 w-10 text-foreground/20" />
          <p className="mt-4 text-sm text-foreground/50">Your bag is empty.</p>
          <Button asChild className="mt-6">
            <Link href="/shop">Browse the shop</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
          <div>
            <FreeShippingBar totals={cart.totals} />
            <div className="mt-2 divide-y divide-border">
              {cart.items.map((line) => (
                <CartLineItem key={line.sku} line={line} />
              ))}
            </div>
          </div>

          <div className="h-fit rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-24">
            <CouponBox />
            <div className="my-4 h-px bg-border" />
            <CartSummary totals={cart.totals} coupon={cart.coupon} />
            <Button size="lg" className="mt-5 w-full" onClick={() => router.push("/checkout")}>
              Checkout
            </Button>
          </div>
        </div>
      )}

      {cart && cart.savedItems.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-xl">Saved for later</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
            {cart.savedItems.map((s) => (
              <div key={s.sku}>
                <Link href={`/products/${s.slug}`} className="relative block aspect-[3/4] overflow-hidden rounded-xl bg-foreground/5">
                  {s.image && <Image src={s.image} alt={s.name} fill className="object-cover" />}
                </Link>
                <p className="mt-2 truncate text-sm font-medium">{s.name}</p>
                <p className="text-xs text-foreground/50">
                  {s.size} · ₹{s.price.toLocaleString("en-IN")}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    magnetic={false}
                    disabled={!s.inStock}
                    onClick={() =>
                      moveToBag(s.sku).catch((err) =>
                        toast({ title: "Couldn't move to bag", description: err?.message, variant: "error" })
                      )
                    }
                  >
                    {s.inStock ? "Move to bag" : "Out of stock"}
                  </Button>
                  <Button size="sm" variant="ghost" magnetic={false} onClick={() => removeSaved(s.sku)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
