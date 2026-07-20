"use client";

import * as React from "react";
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
import type { DashboardData } from "./page";

// Validated categorical palette (dataviz skill reference instance) — fixed
// slot order, entities keep their hue regardless of filters.
const SERIES = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];
// Ordinal blue ramp for the funnel (starts no lighter than step 250).
const ORDINAL = ["#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab"];
const CATEGORY_SLOT: Record<string, string> = { Men: SERIES[0], Women: SERIES[1], Accessories: SERIES[2], Footwear: SERIES[3] };
const METHOD_SLOT: Record<string, string> = { RAZORPAY: SERIES[0], COD: SERIES[1], SNAPMINT: SERIES[2], CASH: SERIES[3], CARD: SERIES[4], UPI: SERIES[5] };

// Recharts' Tooltip defaults to a plain white popup with near-black text —
// theme it off the same CSS variables the axis ticks already use, otherwise
// every chart pops a stark white box in dark mode.
const TOOLTIP_CONTENT_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--foreground)",
};
const TOOLTIP_LABEL_STYLE: React.CSSProperties = { color: "var(--foreground)" };
const TOOLTIP_ITEM_STYLE: React.CSSProperties = { color: "var(--foreground)" };

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function DashboardCharts({ data }: { data: DashboardData }) {
  const { kpis } = data;
  const spark = data.revenueSeries.slice(-14);

  return (
    <>
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Revenue today" value={inr(kpis.revenueToday)} spark={spark} />
        <KpiTile label="Revenue this week" value={inr(kpis.revenueWeek)} spark={spark} />
        <KpiTile label="Revenue this month" value={inr(kpis.revenueMonth)} spark={spark} />
        <KpiTile label={`Orders (${data.range.from} → ${data.range.to})`} value={String(kpis.orderCount)} spark={spark} sparkKey="orders" />
        <KpiTile label="Avg order value" value={inr(kpis.avgOrderValue)} />
        {kpis.trueProfit !== undefined && (
          <KpiTile label="True profit (range)" value={inr(kpis.trueProfit)} hint="from per-product pricing breakdowns, minus discounts" />
        )}
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
            <Tooltip
              formatter={(v) => inr(Number(v))}
              contentStyle={TOOLTIP_CONTENT_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
            />
            <Area type="monotone" dataKey="revenue" stroke={SERIES[0]} strokeWidth={2} fill={SERIES[0]} fillOpacity={0.14} name="Revenue" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sales by category */}
        <ChartCard title="Sales by category">
          {/* The pie's radius is fixed in pixels (Recharts doesn't scale it
              with container size), so squeezing it into 55% of a narrow
              phone's width alongside the legend clipped it — give it its
              own full-width row on mobile and only sit it side-by-side with
              the legend once there's room (sm+). */}
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="w-full sm:w-[55%]">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={data.categorySeries} dataKey="revenue" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
                    {data.categorySeries.map((entry, i) => (
                      <Cell key={entry.name} fill={CATEGORY_SLOT[entry.name] ?? SERIES[i % SERIES.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => inr(Number(v))} contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full space-y-1.5 text-xs sm:w-auto">
              {data.categorySeries.map((c, i) => (
                <li key={c.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CATEGORY_SLOT[c.name] ?? SERIES[i % SERIES.length] }} />
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
              <Tooltip formatter={(v) => inr(Number(v))} contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
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
              <Tooltip formatter={(v) => inr(Number(v))} contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
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
              <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
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
    </>
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
