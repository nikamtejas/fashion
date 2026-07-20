"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Download } from "lucide-react";
import { apiFetch, API_URL } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

// recharts is ~390KB of this route's JS on its own — split it into its own
// chunk so the page shell (and the KPI fetch below) doesn't have to wait on
// it to download/parse/hydrate before anything useful can happen.
const DashboardCharts = dynamic(() => import("./DashboardCharts"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  ),
});

export interface DashboardData {
  range: { from: string; to: string };
  kpis: {
    revenueToday: number;
    revenueWeek: number;
    revenueMonth: number;
    orderCount: number;
    avgOrderValue: number;
    /** Omitted entirely for non-ADMIN callers (OPS) — margin/cost-basis data
     * stays ADMIN-only even though OPS can reach this dashboard. */
    trueProfit?: number;
    refundRate: number;
    refundedValue: number;
    ordersPerCustomer: number;
    customerCount: number;
  };
  revenueSeries: { date: string; revenue: number; orders: number }[];
  categorySeries: { name: string; revenue: number }[];
  topProducts: { name: string; revenue: number; qty: number }[];
  paymentSeries: { method: string; revenue: number }[];
  funnel: { stage: string; count: number }[];
  feeds: {
    recentOrders: { _id: string; orderNumber: string; status: string; pricing: { total: number }; createdAt: string; user?: { email: string } }[];
    lowStock: { name: string; slug: string; sku: string; size: string; color: string; stock: number }[];
    pendingPickups: number;
    pendingRefunds: number;
  };
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function AdminDashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [from, setFrom] = React.useState(() => new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = React.useState(() => new Date().toISOString().slice(0, 10));

  React.useEffect(() => {
    // Refetch on range change; setState in the async callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    setError(null);
    apiFetch<DashboardData>(`/api/admin/dashboard?from=${from}&to=${to}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load the dashboard"));
  }, [from, to]);

  if (error) {
    return (
      <div className="rounded-2xl border border-border p-8 text-center">
        <p className="text-sm text-foreground/60">Couldn&rsquo;t load the dashboard — {error}</p>
        <button
          onClick={() => {
            setError(null);
            apiFetch<DashboardData>(`/api/admin/dashboard?from=${from}&to=${to}`)
              .then(setData)
              .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load the dashboard"));
          }}
          className="mt-3 text-xs text-accent underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { feeds } = data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Dashboard</h1>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-border bg-surface px-2 text-xs" />
          <span className="text-foreground/40">–</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-border bg-surface px-2 text-xs" />
          <a
            href={`${API_URL}/api/admin/dashboard/export.csv?from=${from}&to=${to}`}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:border-accent hover:text-accent"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
        </div>
      </div>

      <DashboardCharts data={data} />

      {/* Live feeds */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Recent orders</p>
          <ul className="mt-3 space-y-2 text-sm">
            {feeds.recentOrders.map((o) => (
              <li key={o._id}>
                <Link href={`/admin/orders/${o._id}`} className="flex items-center justify-between gap-2 hover:underline">
                  <span className="truncate">{o.orderNumber}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant={o.status === "DELIVERED" ? "success" : "outline"}>{o.status.replaceAll("_", " ")}</Badge>
                    <span className="tabular-nums">{inr(o.pricing.total)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Low stock (&lt; 5 units)</p>
          {feeds.lowStock.length === 0 && <p className="mt-3 text-xs text-foreground/40">All good.</p>}
          <ul className="mt-3 space-y-1.5 text-xs">
            {feeds.lowStock.map((l) => (
              <li key={l.sku} className="flex justify-between gap-2">
                <span className="truncate text-foreground/70">
                  {l.name} · {l.size}/{l.color}
                </span>
                <span className={`shrink-0 font-medium tabular-nums ${l.stock === 0 ? "text-red-600" : "text-amber-600"}`}>{l.stock} left</span>
              </li>
            ))}
          </ul>
          <Link href="/admin/inventory" className="mt-3 block text-xs text-accent hover:underline">
            Open inventory →
          </Link>
        </div>

        <div className="space-y-4">
          <Link href="/admin/pickups" className="block rounded-2xl border border-border p-4 hover:border-accent">
            <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Pending pickups</p>
            <p className="font-display mt-1 text-3xl tabular-nums">{feeds.pendingPickups}</p>
          </Link>
          <Link href="/admin/returns" className="block rounded-2xl border border-border p-4 hover:border-accent">
            <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Open refunds</p>
            <p className="font-display mt-1 text-3xl tabular-nums">{feeds.pendingRefunds}</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
