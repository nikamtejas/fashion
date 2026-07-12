"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

interface AdminOrder {
  _id: string;
  orderNumber: string;
  status: string;
  deliveryMethod: "HOME" | "PICKUP";
  createdAt: string;
  pricing: { total: number };
  user?: { email: string; name?: string };
  storeLocation?: { name: string };
}

const STATUSES = ["", "PENDING_PAYMENT", "PLACED", "CONFIRMED", "PACKED", "PICKUP_SCHEDULED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

export default function AdminOrdersPage() {
  const [orders, setOrders] = React.useState<AdminOrder[] | null>(null);
  const [status, setStatus] = React.useState("");
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = React.useState("CONFIRMED");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    setOrders(null);
    setSelected(new Set());
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    apiFetch<{ orders: AdminOrder[] }>(`/api/admin/orders?${params}`).then((data) => setOrders(data.orders));
  }, [status, q]);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      // Debounced refetch on filter/search change; setState in callback.
       
      load();
    }, 250);
    return () => clearTimeout(handle);
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyBulk() {
    setBusy(true);
    try {
      await apiFetch("/api/admin/orders/bulk-status", { method: "POST", json: { ids: [...selected], status: bulkStatus } });
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Orders</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search order # or email…"
            className="h-10 w-56 rounded-lg border border-border bg-surface px-3 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "" ? "All statuses" : s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/5 px-4 py-2 text-sm">
          <span>{selected.size} selected</span>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="h-8 rounded-lg border border-border bg-surface px-2 text-xs">
            {["CONFIRMED", "PACKED", "DELIVERED", "CANCELLED"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button onClick={applyBulk} disabled={busy} className="rounded-lg bg-ink px-3 py-1.5 text-xs text-ivory dark:bg-ivory dark:text-ink">
            {busy ? "Applying…" : "Apply"}
          </button>
        </div>
      )}

      {orders === null && (
        <div className="mt-8 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      {orders?.length === 0 && <p className="mt-8 text-sm text-foreground/50">No orders.</p>}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-foreground/50">
            <tr>
              <th className="w-8 px-3 py-3" />
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((o) => (
              <tr key={o._id} className="border-t border-border hover:bg-foreground/5">
                <td className="px-3 py-3">
                  <input type="checkbox" checked={selected.has(o._id)} onChange={() => toggle(o._id)} aria-label={`Select ${o.orderNumber}`} />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${o._id}`} className="font-medium hover:underline">
                    {o.orderNumber}
                  </Link>
                  <p className="text-xs text-foreground/40">{new Date(o.createdAt).toLocaleDateString("en-IN")}</p>
                </td>
                <td className="px-4 py-3 text-foreground/60">{o.user?.email ?? "—"}</td>
                <td className="px-4 py-3 text-foreground/60">
                  {o.deliveryMethod === "PICKUP" ? `Pickup — ${o.storeLocation?.name ?? ""}` : "Home"}
                </td>
                <td className="px-4 py-3 tabular-nums">₹{o.pricing.total.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3">
                  <Badge variant={o.status === "DELIVERED" ? "success" : "outline"}>{o.status.replaceAll("_", " ")}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
