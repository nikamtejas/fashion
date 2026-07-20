"use client";

import * as React from "react";
import { Coins } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

interface LoyaltyHistoryEntry {
  type: "EARN" | "REDEEM";
  points: number;
  date: string;
  orderNumber?: string;
  productName?: string;
  extraItemCount?: number;
}

interface LoyaltyData {
  points: number;
  earnRate: number;
  history: LoyaltyHistoryEntry[];
}

// Concrete order-total examples so "1 point per ₹100" isn't the only thing
// on the page — computed off the live rate, not hardcoded, so it stays
// correct if the rate ever changes.
const EXAMPLE_MULTIPLES = [1, 5, 10, 30];

export function LoyaltySection() {
  const [data, setData] = React.useState<LoyaltyData | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    apiFetch<LoyaltyData>("/api/loyalty")
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return <p className="text-sm text-foreground/60">Couldn&rsquo;t load your loyalty points — try refreshing the page.</p>;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Your balance</p>
        <div className="mt-2 flex items-baseline gap-2">
          <Coins className="h-6 w-6 text-sienna" />
          <span className="font-display text-3xl tabular-nums">{data.points.toLocaleString("en-IN")}</span>
          <span className="text-sm text-foreground/50">points</span>
        </div>
        <p className="mt-1 text-sm text-foreground/60">
          Worth ₹{data.points.toLocaleString("en-IN")} off your next order — redeem any amount at checkout.
        </p>

        <div className="mt-4 rounded-xl bg-surface p-4 text-sm text-foreground/70">
          <p className="font-medium text-foreground">How points work</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            <li>Earn 1 point for every ₹{data.earnRate} you spend on a confirmed, paid order (rounded down to the nearest point).</li>
            <li>1 point = ₹1 — use as much of your balance as you like at checkout, up to your order total.</li>
            <li>Points are credited once payment is confirmed. In-store purchases don&rsquo;t earn points.</li>
            <li>If an order you redeemed points on is later cancelled, those points are returned to your balance.</li>
          </ul>

          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-background/60 text-left uppercase tracking-wider text-foreground/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Order total</th>
                  <th className="px-3 py-2 font-medium">Points earned</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLE_MULTIPLES.map((mult) => (
                  <tr key={mult} className="border-t border-border">
                    <td className="px-3 py-2 tabular-nums">₹{(data.earnRate * mult).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2 font-medium tabular-nums">{mult} pt{mult === 1 ? "" : "s"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border p-5">
        <p className="text-sm font-medium">Recent activity</p>
        {data.history.length === 0 ? (
          <p className="mt-3 text-sm text-foreground/50">No activity yet — place an order to start earning points.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {data.history.map((h, i) => {
              const title = h.productName
                ? h.extraItemCount
                  ? `${h.productName} +${h.extraItemCount} more`
                  : h.productName
                : h.type === "EARN"
                  ? "Points earned"
                  : "Points redeemed";
              return (
                <li key={i} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{title}</p>
                    <p className="text-xs text-foreground/50">
                      {h.type === "EARN" ? "Earned" : "Redeemed"}
                      {h.orderNumber ? ` · Order ${h.orderNumber}` : ""} ·{" "}
                      {new Date(h.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 tabular-nums font-medium",
                      h.type === "EARN" ? "text-[var(--color-sage-dark)]" : "text-foreground/70"
                    )}
                  >
                    {h.type === "EARN" ? "+" : "−"}
                    {h.points}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
