"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getOrder, type Order } from "@/lib/orders";
import { ApiRequestError } from "@/lib/api";

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOrder(id)
      .then((res) => setOrder(res.order))
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : "Failed to load order"));
  }, [id]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!order) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <div className="h-8 w-64 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="h-64 w-full animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
      </div>
    );
  }

  const customer = typeof order.userId === "string" ? null : order.userId;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Order</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">{order._id}</p>

      <div className="mt-6 rounded-xl border border-black/10 p-4 text-sm dark:border-white/10">
        <p className="font-medium">Customer</p>
        <p className="mt-1 text-black/70 dark:text-white/70">
          {customer ? `${customer.name} (${customer.email})` : "—"}
        </p>
        {order.whatsappNumber && (
          <p className="mt-1 text-black/70 dark:text-white/70">WhatsApp: {order.whatsappNumber}</p>
        )}
      </div>

      <div className="mt-4 flex flex-col divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
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
          value={`${order.payment.method}${order.payment.razorpayMethod ? ` (${order.payment.razorpayMethod})` : ""} — ${order.payment.status}`}
        />
        <Row label="Order status" value={order.status} />
      </div>

      <div className="mt-4 rounded-xl border border-black/10 p-4 text-sm dark:border-white/10">
        <p className="mb-1 font-medium">Shipping to</p>
        <p className="text-black/70 dark:text-white/70">
          {order.shippingAddress.line1}
          {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}, {order.shippingAddress.city},{" "}
          {order.shippingAddress.state} — {order.shippingAddress.pincode}
        </p>
        <p className="mt-2 text-xs text-black/50 dark:text-white/50">
          DHL tracking and status updates arrive in Milestone 6.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 capitalize ${emphasis ? "font-medium" : "text-black/70 dark:text-white/70"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
