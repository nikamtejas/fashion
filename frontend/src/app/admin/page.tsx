"use client";

import * as React from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { apiFetch, API_URL } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

// Validated categorical palette (dataviz skill reference instance) — fixed
// slot order, entities keep their hue regardless of filters.
const SERIES = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];
// Ordinal blue ramp for the funnel (starts no lighter than step 250).
const ORDINAL = ["#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab"];
const CATEGORY_SLOT: Record<string, string> = { Men: SERIES[0], Women: SERIES[1], Accessories: SERIES[2], Footwear: SERIES[3] };
const METHOD_SLOT: Record<string, string> = { RAZORPAY: SERIES[0], COD: SERIES[1], SNAPMINT: SERIES[2], CASH: SERIES[3], CARD: SERIES[4], UPI: SERIES[5] };

interface DashboardData {
  range: { from: string; to: string };
  kpis: {
    revenueToday: number;
    revenueWeek: number;
    revenueMonth: number;
    orderCount: number;
    avgOrderValue: number;
    trueProfit: number;
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

  const { kpis, feeds } = data;
  const spark = data.revenueSeries.slice(-14);

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

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Revenue today" value={inr(kpis.revenueToday)} spark={spark} />
        <KpiTile label="Revenue this week" value={inr(kpis.revenueWeek)} spark={spark} />
        <KpiTile label="Revenue this month" value={inr(kpis.revenueMonth)} spark={spark} />
        <KpiTile label={`Orders (${data.range.from} → ${data.range.to})`} value={String(kpis.orderCount)} spark={spark} sparkKey="orders" />
        <KpiTile label="Avg order value" value={inr(kpis.avgOrderValue)} />
        <KpiTile label="True profit (range)" value={inr(kpis.trueProfit)} hint="from per-product pricing breakdowns, minus discounts" />
        <KpiTile label="Refund rate" value={`${kpis.refundRate}%`} hint={`${inr(kpis.refundedValue)} refunded`} />
        <KpiTile label="Orders / customer" value={String(kpis.ordersPerCustomer)} hint={`${kpis.customerCount} customers — visitor analytics lands later`} />
      </div>

      {/* Revenue over time */}
      <ChartCard title="Revenue over time" subtitle="Confirmed orders, daily">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data.revenueSeries} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--foreground)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} tickFormatter={(d: string) => d.slice(5)} />
            <YAxis tick={{ fontSize: 10, fill: "var(--foreground)" }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
            <Tooltip formatter={(v) => inr(Number(v))} labelStyle={{ color: "#141414" }} />
            <Area type="monotone" dataKey="revenue" stroke={SERIES[0]} strokeWidth={2} fill={SERIES[0]} fillOpacity={0.14} name="Revenue" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sales by category */}
        <ChartCard title="Sales by category">
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={220}>
              <PieChart>
                <Pie data={data.categorySeries} dataKey="revenue" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
                  {data.categorySeries.map((entry, i) => (
                    <Cell key={entry.name} fill={CATEGORY_SLOT[entry.name] ?? SERIES[i % SERIES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => inr(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-1.5 text-xs">
              {data.categorySeries.map((c, i) => (
                <li key={c.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORY_SLOT[c.name] ?? SERIES[i % SERIES.length] }} />
                  <span className="text-foreground/70">{c.name}</span>
                  <span className="ml-auto tabular-nums">{inr(c.revenue)}</span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>

        {/* Payment method split */}
        <ChartCard title="Payment methods" subtitle="Revenue by rail">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.paymentSeries} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 8 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="method" width={80} tick={{ fontSize: 10, fill: "var(--foreground)" }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => inr(Number(v))} />
              <Bar dataKey="revenue" barSize={14} radius={[0, 4, 4, 0]} name="Revenue">
                {data.paymentSeries.map((entry) => (
                  <Cell key={entry.method} fill={METHOD_SLOT[entry.method] ?? SERIES[7]} />
                ))}
                <LabelList dataKey="revenue" position="right" formatter={(v: React.ReactNode) => inr(Number(v))} style={{ fontSize: 10, fill: "var(--foreground)" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top products */}
        <ChartCard title="Top products" subtitle="By revenue in range">
          <ResponsiveContainer width="100%" height={Math.max(180, data.topProducts.length * 28)}>
            <BarChart data={data.topProducts} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 8 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10, fill: "var(--foreground)" }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => inr(Number(v))} />
              <Bar dataKey="revenue" barSize={12} radius={[0, 4, 4, 0]} fill={SERIES[0]} name="Revenue">
                <LabelList dataKey="revenue" position="right" formatter={(v: React.ReactNode) => inr(Number(v))} style={{ fontSize: 10, fill: "var(--foreground)" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Order status funnel */}
        <ChartCard title="Order status funnel" subtitle="Orders reaching each stage">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.funnel} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 8 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="stage" width={130} tick={{ fontSize: 10, fill: "var(--foreground)" }} tickLine={false} axisLine={false} tickFormatter={(s: string) => s.replaceAll("_", " ")} />
              <Tooltip />
              <Bar dataKey="count" barSize={12} radius={[0, 4, 4, 0]} name="Orders">
                {data.funnel.map((entry, i) => (
                  <Cell key={entry.stage} fill={ORDINAL[Math.min(i, ORDINAL.length - 1)]} />
                ))}
                <LabelList dataKey="count" position="right" style={{ fontSize: 10, fill: "var(--foreground)" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

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

function KpiTile({
  label,
  value,
  hint,
  spark,
  sparkKey = "revenue",
}: {
  label: string;
  value: string;
  hint?: string;
  spark?: { date: string; revenue: number; orders: number }[];
  sparkKey?: "revenue" | "orders";
}) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-foreground/50">{label}</p>
      <p className="font-display mt-1 text-2xl tabular-nums">{value}</p>
      {spark && spark.length > 1 && (
        <div className="mt-2 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <Area type="monotone" dataKey={sparkKey} stroke="#2a78d6" strokeWidth={1.5} fill="#2a78d6" fillOpacity={0.12} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {hint && <p className="mt-1 text-[10px] text-foreground/40">{hint}</p>}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="text-sm font-medium">{title}</p>
      {subtitle && <p className="text-xs text-foreground/50">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}
