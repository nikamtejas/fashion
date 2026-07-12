"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface EmiPlan {
  tenureMonths: number;
  monthlyAmount: number;
  downPayment: number;
  totalPayable: number;
  interestPct: number;
}

interface EmiResponse {
  eligible: boolean;
  threshold: number;
  plans: EmiPlan[];
}

/**
 * "EMI from ₹X/month" — renders nothing at all below the admin-configured
 * threshold, so ineligible products/carts never mention EMI.
 */
export function EmiWidget({ amount, variant = "full" }: { amount: number; variant?: "full" | "compact" }) {
  const [data, setData] = React.useState<EmiResponse | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (amount <= 0) return;
    apiFetch<EmiResponse>(`/api/payments/emi-plans?amount=${amount}`)
      .then(setData)
      .catch(() => setData(null));
  }, [amount]);

  if (!data?.eligible || data.plans.length === 0) return null;

  const from = Math.min(...data.plans.map((p) => p.monthlyAmount));

  if (variant === "compact") {
    return (
      <p className="text-xs text-foreground/60">
        EMI from <span className="font-medium text-foreground">₹{from.toLocaleString("en-IN")}/month</span> with Snapmint
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm">
          EMI from <span className="font-medium">₹{from.toLocaleString("en-IN")}/month</span>{" "}
          <span className="text-xs text-foreground/50">with Snapmint</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-foreground/40 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          <table className="w-full text-xs">
            <thead className="text-left uppercase tracking-wider text-foreground/40">
              <tr>
                <th className="py-1.5">Tenure</th>
                <th className="py-1.5">Monthly</th>
                <th className="py-1.5">Down payment</th>
                <th className="py-1.5">Total</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {data.plans.map((p) => (
                <tr key={p.tenureMonths} className="border-t border-border/60">
                  <td className="py-1.5">{p.tenureMonths} months</td>
                  <td className="py-1.5 font-medium">₹{p.monthlyAmount.toLocaleString("en-IN")}</td>
                  <td className="py-1.5">{p.downPayment > 0 ? `₹${p.downPayment.toLocaleString("en-IN")}` : "None"}</td>
                  <td className="py-1.5 text-foreground/60">₹{p.totalPayable.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-foreground/40">
            Available at checkout on orders of ₹{data.threshold.toLocaleString("en-IN")}+
          </p>
        </div>
      )}
    </div>
  );
}
