"use client";

import { motion } from "framer-motion";
import { Truck } from "lucide-react";
import type { CartTotals } from "@/store/cartStore";

export function FreeShippingBar({ totals }: { totals: CartTotals }) {
  const progress = Math.min(
    100,
    ((totals.freeShippingThreshold - totals.amountToFreeShipping) / totals.freeShippingThreshold) * 100
  );
  const qualified = totals.amountToFreeShipping <= 0;

  return (
    <div className="rounded-xl bg-sage/10 p-3">
      <p className="flex items-center gap-1.5 text-xs text-[var(--color-sage-dark)]">
        <Truck className="h-3.5 w-3.5" />
        {qualified
          ? "You've unlocked free shipping!"
          : `Add ₹${totals.amountToFreeShipping.toLocaleString("en-IN")} more for free shipping`}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sage/20">
        <motion.div
          className="h-full rounded-full bg-sage"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}
