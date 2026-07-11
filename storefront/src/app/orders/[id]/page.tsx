"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrder, type Order } from "@/lib/orders";
import { ApiRequestError } from "@/lib/api";

const STATUS_LABELS: Record<Order["status"], string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOrder(id)
      .then((res) => setOrder(res.order))
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : "Failed to load order"));
  }, [id]);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <div className="h-8 w-64 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          <div className="mt-4 h-40 w-full animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
          Order {STATUS_LABELS[order.status]}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Thanks for your order</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">Order ID: {order._id}</p>

        <div className="mt-6 flex flex-col divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between p-4 text-sm">
              <div>
                <p className="font-medium">{item.name}</p>
                {(item.size || item.color) && (
                  <p className="text-black/60 dark:text-white/60">
                    {[item.size, item.color].filter(Boolean).join(" / ")} × {item.qty}
                  </p>
                )}
              </div>
              <p>₹{(item.price * item.qty).toFixed(2)}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-black/10 p-4 text-sm dark:border-white/10">
          <Row label="Subtotal" value={`₹${order.subtotal.toFixed(2)}`} />
          {order.discount > 0 && <Row label={`Coupon (${order.couponCode})`} value={`−₹${order.discount.toFixed(2)}`} />}
          <Row label="Total" value={`₹${order.total.toFixed(2)}`} emphasis />
          <Row
            label="Payment"
            value={
              order.payment.method === "cod"
                ? "Cash on delivery"
                : `Razorpay (${order.payment.status}${order.payment.razorpayMethod ? `, ${order.payment.razorpayMethod}` : ""})`
            }
          />
        </div>

        <div className="mt-4 rounded-xl border border-black/10 p-4 text-sm dark:border-white/10">
          <p className="mb-1 font-medium">Shipping to</p>
          <p className="text-black/70 dark:text-white/70">
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}, {order.shippingAddress.city},{" "}
            {order.shippingAddress.state} — {order.shippingAddress.pincode}
          </p>
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">
            Tracking will appear here once your order ships (Milestone 6).
          </p>
        </div>

        <Link
          href="/account/orders"
          className="mt-6 inline-block text-sm font-medium underline underline-offset-2"
        >
          View all orders
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 ${emphasis ? "font-medium" : "text-black/70 dark:text-white/70"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
