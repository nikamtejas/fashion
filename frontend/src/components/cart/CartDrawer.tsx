"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useCartStore } from "@/store/cartStore";
import { useAuth } from "@/context/AuthContext";
import { CartLineItem } from "./CartLineItem";
import { CartSummary } from "./CartSummary";
import { FreeShippingBar } from "./FreeShippingBar";

export function CartDrawer() {
  const { user } = useAuth();
  const router = useRouter();
  const cart = useCartStore((s) => s.cart);
  const open = useCartStore((s) => s.drawerOpen);
  const closeDrawer = useCartStore((s) => s.closeDrawer);

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <Drawer open={open} onOpenChange={(o) => !o && closeDrawer()} title={`Your bag${cart ? ` (${cart.totals.itemCount})` : ""}`}>
      {!user ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <ShoppingBag className="h-10 w-10 text-foreground/20" />
          <p className="text-sm text-foreground/50">Sign in to see your bag.</p>
          <Button
            onClick={() => {
              closeDrawer();
              router.push("/login");
            }}
          >
            Sign in
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <ShoppingBag className="h-10 w-10 text-foreground/20" />
          <p className="text-sm text-foreground/50">Your bag is empty.</p>
          <Button
            onClick={() => {
              closeDrawer();
              router.push("/shop");
            }}
          >
            Browse the shop
          </Button>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <FreeShippingBar totals={cart.totals} />

          <div className="flex-1 divide-y divide-border overflow-y-auto">
            {cart.items.map((line) => (
              <CartLineItem key={line.sku} line={line} compact />
            ))}
          </div>

          <div className="border-t border-border pt-4">
            <CartSummary totals={cart.totals} coupon={cart.coupon} />
            <div className="mt-4 flex flex-col gap-2">
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  closeDrawer();
                  router.push("/checkout");
                }}
              >
                Checkout
              </Button>
              <Link
                href="/cart"
                onClick={closeDrawer}
                className="text-center text-xs text-foreground/50 underline underline-offset-2"
              >
                View full bag
              </Link>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
