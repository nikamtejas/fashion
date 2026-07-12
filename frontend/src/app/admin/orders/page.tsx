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

  React.useEffect(() => {
    // Refetch on filter change; setState in the async callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrders(null);
    apiFetch<{ orders: AdminOrder[] }>(`/api/admin/orders${status ? `?status=${status}` : ""}`).then((data) =>
      setOrders(data.orders)
    );
  }, [status]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Orders</h1>
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
