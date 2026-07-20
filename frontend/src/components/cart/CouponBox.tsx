"use client";

import * as React from "react";
import { Tag, X, ChevronUp } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { useCartStore } from "@/store/cartStore";
import { useToast } from "@/components/ui/Toast";

interface AvailableCoupon {
  code: string;
  description: string;
  minOrderValue: number;
  discount: number;
}

// Loaded on demand — only fires once a coupon is successfully applied, so
// there's no reason to ship it in this route's initial JS chunk.
function fireConfetti() {
  import("canvas-confetti").then(({ default: confetti }) => {
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors: ["#C15B3C", "#8A9A7E", "#141414", "#FAF7F2"] });
  });
}

export function CouponBox() {
  const { toast } = useToast();
  const cart = useCartStore((s) => s.cart);
  const applyCoupon = useCartStore((s) => s.applyCoupon);
  const removeCoupon = useCartStore((s) => s.removeCoupon);

  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [available, setAvailable] = React.useState<AvailableCoupon[] | null>(null);

  async function handleApply(applyCode: string) {
    setBusy(true);
    setError(null);
    try {
      const view = await applyCoupon(applyCode);
      fireConfetti();
      toast({
        title: "Coupon applied",
        description: `You saved ₹${view.coupon?.discount.toLocaleString("en-IN")}`,
        variant: "success",
      });
      setCode("");
      setSheetOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't apply coupon");
    } finally {
      setBusy(false);
    }
  }

  async function openSheet() {
    setSheetOpen(true);
    try {
      const data = await apiFetch<{ coupons: AvailableCoupon[] }>("/api/cart/coupons/available");
      setAvailable(data.coupons);
    } catch {
      setAvailable([]);
    }
  }

  if (cart?.coupon) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-sage/40 bg-sage/10 px-3 py-2.5">
        <p className="flex items-center gap-2 text-sm text-[var(--color-sage-dark)]">
          <Tag className="h-4 w-4" />
          <span className="font-medium">{cart.coupon.code}</span> — ₹
          {cart.coupon.discount.toLocaleString("en-IN")} off
        </p>
        <button aria-label="Remove coupon" onClick={() => removeCoupon()} className="p-1 text-foreground/40 hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) handleApply(code.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          placeholder="Coupon code"
          className="h-10 flex-1 rounded-lg border border-border bg-surface px-3 text-sm uppercase tracking-wider"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="rounded-lg bg-ink px-4 text-xs font-medium uppercase tracking-wider text-ivory disabled:opacity-40 dark:bg-ivory dark:text-ink"
        >
          {busy ? "…" : "Apply"}
        </button>
      </form>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      <button onClick={openSheet} className="mt-2 flex items-center gap-1 text-xs text-accent hover:underline">
        <ChevronUp className="h-3 w-3" /> View available coupons
      </button>

      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-3xl border-t border-border bg-surface p-6"
            >
              <div className="mx-auto max-w-lg">
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
                <h3 className="font-display text-lg">Available coupons</h3>

                {available === null && <p className="mt-4 text-sm text-foreground/50">Checking…</p>}
                {available?.length === 0 && (
                  <p className="mt-4 text-sm text-foreground/50">No coupons apply to your bag right now.</p>
                )}

                <div className="mt-4 space-y-3">
                  {available?.map((c) => (
                    <div key={c.code} className="flex items-center justify-between rounded-xl border border-dashed border-accent/50 bg-accent/5 p-3">
                      <div>
                        <p className="text-sm font-semibold tracking-wider">{c.code}</p>
                        <p className="text-xs text-foreground/60">
                          {c.description} · saves you ₹{c.discount.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <button
                        disabled={busy}
                        onClick={() => handleApply(c.code)}
                        className="rounded-full bg-sienna px-4 py-1.5 text-xs font-medium text-white"
                      >
                        Apply
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
