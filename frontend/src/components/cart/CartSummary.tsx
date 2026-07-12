"use client";

import type { CartTotals } from "@/store/cartStore";

export function CartSummary({ totals, coupon }: { totals: CartTotals; coupon?: { code: string } | null }) {
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex justify-between text-foreground/60">
        <dt>Items (excl. GST)</dt>
        <dd className="tabular-nums">₹{totals.preTaxSubtotal.toLocaleString("en-IN")}</dd>
      </div>
      <div className="flex justify-between text-foreground/60">
        <dt>GST</dt>
        <dd className="tabular-nums">₹{totals.gst.toLocaleString("en-IN")}</dd>
      </div>
      {totals.discount > 0 && (
        <div className="flex justify-between text-[var(--color-sage-dark)]">
          <dt>Discount{coupon ? ` (${coupon.code})` : ""}</dt>
          <dd className="tabular-nums">−₹{totals.discount.toLocaleString("en-IN")}</dd>
        </div>
      )}
      <div className="flex justify-between text-foreground/60">
        <dt>Shipping</dt>
        <dd className="tabular-nums">{totals.shipping === 0 ? "Free" : `₹${totals.shipping}`}</dd>
      </div>
      <div className="!mt-3 flex justify-between border-t border-border pt-3 text-base font-medium">
        <dt>Total</dt>
        <dd className="tabular-nums">₹{totals.total.toLocaleString("en-IN")}</dd>
      </div>
    </dl>
  );
}
