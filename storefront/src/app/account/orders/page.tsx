"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listOrders, type Order } from "@/lib/orders";
import { ApiRequestError } from "@/lib/api";

export default function OrderHistoryPage() {
  const [items, setItems] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listOrders()
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : "Failed to load orders"));
  }, []);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 h-6 w-32 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="h-32 w-full animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">No orders yet</h1>
        <p className="mt-3 max-w-sm text-black/60 dark:text-white/60">
          Once you place an order, it&apos;ll show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 text-xl font-semibold tracking-tight sm:text-2xl">Your orders</h1>
      <div className="mx-auto flex max-w-2xl flex-col divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
        {items.map((order) => (
          <Link
            key={order._id}
            href={`/orders/${order._id}`}
            className="flex items-center justify-between p-4 text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            <div>
              <p className="font-medium">
                {order.items.length} item{order.items.length === 1 ? "" : "s"} · ₹{order.total.toFixed(2)}
              </p>
              <p className="text-black/60 dark:text-white/60">
                {new Date(order.createdAt).toLocaleDateString()} · {order.status}
              </p>
            </div>
            <span className="text-black/40 dark:text-white/40">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
