"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

interface Customer {
  id: string;
  name?: string;
  email: string;
  joinedAt: string;
  lifetimeValue: number;
  orderCount: number;
  lastOrderAt: string | null;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = React.useState<Customer[] | null>(null);

  React.useEffect(() => {
    apiFetch<{ customers: Customer[] }>("/api/admin/customers").then((d) =>
      setCustomers([...d.customers].sort((a, b) => b.lifetimeValue - a.lifetimeValue))
    );
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl">Customers</h1>
      {customers === null && <Skeleton className="mt-6 h-48 w-full" />}
      {customers && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wider text-foreground/50">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Last order</th>
                <th className="px-4 py-3">Lifetime value</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{c.name ?? "—"}</p>
                    <p className="text-xs text-foreground/50">{c.email}</p>
                  </td>
                  <td className="px-4 py-2.5 text-foreground/60">{new Date(c.joinedAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-2.5 tabular-nums">{c.orderCount}</td>
                  <td className="px-4 py-2.5 text-foreground/60">
                    {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-medium tabular-nums">₹{c.lifetimeValue.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
