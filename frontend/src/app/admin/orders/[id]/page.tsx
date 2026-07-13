"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Truck, FileText } from "lucide-react";
import { apiFetch, API_URL } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface AdminOrderDetail {
  order: {
    _id: string;
    orderNumber: string;
    status: string;
    deliveryMethod: "HOME" | "PICKUP";
    createdAt: string;
    items: { name: string; sku: string; size?: string; color?: string; price: number; qty: number }[];
    pricing: { subtotal: number; discount: number; gst: number; shipping: number; codFee?: number; total: number };
    shippingAddress?: { name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string };
    storeLocation?: { name: string; city: string };
    user?: { email: string; name?: string };
  };
  payment: { method: string; status: string; razorpayPaymentId?: string; snapmintPlan?: { tenureMonths: number; monthlyAmount: number } } | null;
  shipment: { _id: string; awbNumber?: string; status: string; estimatedDelivery?: string } | null;
  events: { status: string; location?: string; description?: string; timestamp: string }[];
  appointment: { date: string; timeSlot: string; status: string } | null;
}

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [data, setData] = React.useState<AdminOrderDetail | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    apiFetch<AdminOrderDetail>(`/api/admin/orders/${id}`).then(setData);
  }, [id]);

  React.useEffect(() => {
     
    load();
  }, [load]);

  async function readyToShip() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/orders/${id}/ready-to-ship`, { method: "POST" });
      toast({ title: "Shipment created", description: "Waybill generated and courier pickup scheduled.", variant: "success" });
      load();
    } catch (err) {
      toast({ title: "Couldn't ship", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function collectCash() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/orders/${id}/cod/mark-cash-collected`, { method: "POST" });
      toast({ title: "Cash collected — payment marked paid", variant: "success" });
      load();
    } catch (err) {
      toast({ title: "Couldn't record payment", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="text-sm text-foreground/50">Loading…</p>;
  const { order, payment, shipment, events, appointment } = data;

  const canShip = order.deliveryMethod === "HOME" && ["PLACED", "CONFIRMED"].includes(order.status) && !shipment;
  const canCollectCash =
    order.deliveryMethod === "HOME" &&
    payment?.method === "COD" &&
    payment?.status !== "PAID" &&
    ["OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status);

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">{order.orderNumber}</h1>
          <p className="mt-1 text-xs text-foreground/50">
            {order.user?.email} · {new Date(order.createdAt).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={order.status === "DELIVERED" ? "success" : "outline"}>{order.status.replaceAll("_", " ")}</Badge>
          {canShip && (
            <Button size="sm" magnetic={false} disabled={busy} onClick={readyToShip}>
              <Truck className="h-3.5 w-3.5" /> {busy ? "Creating…" : "Ready to ship"}
            </Button>
          )}
          {shipment?.awbNumber && (
            <Button size="sm" variant="outline" magnetic={false} asChild>
              <a href={`${API_URL}/api/admin/orders/${order._id}/label.pdf`} target="_blank" rel="noreferrer">
                <FileText className="h-3.5 w-3.5" /> Label
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Payment</p>
          <p className="mt-1 text-sm">
            {payment?.method ?? "—"} · <Badge variant={payment?.status === "PAID" ? "success" : "outline"}>{payment?.status ?? "—"}</Badge>
          </p>
          {payment?.snapmintPlan && (
            <p className="mt-1 text-xs text-foreground/50">
              EMI {payment.snapmintPlan.tenureMonths}mo · ₹{payment.snapmintPlan.monthlyAmount}/mo
            </p>
          )}
          <p className="mt-2 text-sm tabular-nums">Total ₹{order.pricing.total.toLocaleString("en-IN")}</p>
          {canCollectCash && (
            <Button size="sm" className="mt-3 w-full" magnetic={false} disabled={busy} onClick={collectCash}>
              {busy ? "Recording…" : "Cash collected — mark as paid"}
            </Button>
          )}
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">
            {order.deliveryMethod === "PICKUP" ? "Pickup" : "Delivery"}
          </p>
          {order.deliveryMethod === "PICKUP" ? (
            <p className="mt-1 text-sm">
              {order.storeLocation?.name}
              {appointment && (
                <>
                  <br />
                  <span className="text-xs text-foreground/50">
                    {new Date(appointment.date).toLocaleDateString("en-IN")} · {appointment.timeSlot} · {appointment.status}
                  </span>
                </>
              )}
            </p>
          ) : (
            <p className="mt-1 text-sm">
              {order.shippingAddress?.name}
              <br />
              <span className="text-xs text-foreground/50">
                {order.shippingAddress?.line1}, {order.shippingAddress?.city} — {order.shippingAddress?.pincode}
              </span>
            </p>
          )}
          {shipment && (
            <p className="mt-2 text-xs text-foreground/50">
              AWB {shipment.awbNumber} · {shipment.status.replaceAll("_", " ")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Items</p>
        <ul className="mt-2 space-y-1 text-sm">
          {order.items.map((i) => (
            <li key={i.sku} className="flex justify-between">
              <span>
                {i.name} · {i.size} / {i.color} × {i.qty}
              </span>
              <span className="tabular-nums">₹{(i.price * i.qty).toLocaleString("en-IN")}</span>
            </li>
          ))}
        </ul>
      </div>

      {events.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Shipment events</p>
          <ul className="mt-2 space-y-1.5 text-xs text-foreground/60">
            {[...events].reverse().map((e, i) => (
              <li key={i}>
                <span className="font-medium text-foreground">{e.status.replaceAll("_", " ")}</span> — {e.description}
                {e.location ? ` · ${e.location}` : ""} · {new Date(e.timestamp).toLocaleString("en-IN")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
