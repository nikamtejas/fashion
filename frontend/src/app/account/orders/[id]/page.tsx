"use client";

import * as React from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { CalendarPlus, CalendarX2, CalendarClock } from "lucide-react";
import { apiFetch, API_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { SlotCalendar } from "@/components/checkout/SlotCalendar";
import { CartSummary } from "@/components/cart/CartSummary";
import { ReturnRequestModal } from "@/components/returns/ReturnRequestModal";
import { ReturnCard, type ReturnView } from "@/components/returns/ReturnCard";

interface OrderDetail {
  _id: string;
  orderNumber: string;
  status: string;
  deliveryMethod: "HOME" | "PICKUP";
  createdAt: string;
  items: { sku: string; name: string; image?: string; size?: string; color?: string; price: number; qty: number }[];
  pricing: { subtotal: number; discount: number; gst: number; shipping: number; total: number };
  shippingAddress?: { name: string; line1: string; line2?: string; city: string; state: string; pincode: string };
  storeLocation?: { _id: string; name: string; address: string; city: string; state: string; pincode: string };
  coupon?: { code: string };
}

interface Appointment {
  _id: string;
  date: string;
  timeSlot: string;
  status: string;
  qrCode: string;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [order, setOrder] = React.useState<OrderDetail | null>(null);
  const [appointment, setAppointment] = React.useState<Appointment | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [newSlot, setNewSlot] = React.useState<{ date: string; timeSlot: string } | undefined>();
  const [busy, setBusy] = React.useState(false);
  const [returns, setReturns] = React.useState<ReturnView[]>([]);
  const [returnOpen, setReturnOpen] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  const load = React.useCallback(() => {
    apiFetch<{ order: OrderDetail; appointment: Appointment | null }>(`/api/orders/${id}`)
      .then((data) => {
        setOrder(data.order);
        setAppointment(data.appointment);
      })
      .catch(() => router.replace("/account/orders"));
    apiFetch<{ returns: ReturnView[] }>(`/api/returns?orderId=${id}`)
      .then((data) => setReturns(data.returns))
      .catch(() => {});
    apiFetch<{ payment: { method: string } | null }>(`/api/payments/order/${id}`)
      .then((data) => setPaymentMethod(data.payment?.method))
      .catch(() => {});
  }, [id, router]);

  React.useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function handleReschedule() {
    if (!appointment || !newSlot) return;
    setBusy(true);
    try {
      await apiFetch(`/api/appointments/${appointment._id}`, { method: "PATCH", json: newSlot });
      toast({ title: "Pickup rescheduled", variant: "success" });
      setRescheduleOpen(false);
      setNewSlot(undefined);
      load();
    } catch (err) {
      toast({ title: "Couldn't reschedule", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!appointment) return;
    setBusy(true);
    try {
      await apiFetch(`/api/appointments/${appointment._id}/cancel`, { method: "POST" });
      toast({ title: "Pickup appointment cancelled" });
      load();
    } catch (err) {
      toast({ title: "Couldn't cancel", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!order) return <div className="py-20 text-center text-sm text-foreground/50">Loading…</div>;

  const appointmentActive = appointment && ["BOOKED", "READY"].includes(appointment.status);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">{order.orderNumber}</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Placed {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={order.status === "DELIVERED" ? "success" : "outline"}>{order.status.replaceAll("_", " ")}</Badge>
          <Button size="sm" variant="outline" magnetic={false} onClick={() => router.push(`/track/${order._id}`)}>
            Track order
          </Button>
          {order.status === "DELIVERED" && (
            <Button size="sm" magnetic={false} onClick={() => setReturnOpen(true)}>
              Return / refund
            </Button>
          )}
        </div>
      </div>

      {order.status === "PENDING_PAYMENT" && (
        <div className="mt-6 flex items-center justify-between rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Payment pending — your items are reserved for a limited time.
          </p>
          <Button size="sm" magnetic={false} onClick={() => router.push(`/orders/${order._id}/pay`)}>
            Retry payment
          </Button>
        </div>
      )}

      {order.deliveryMethod === "PICKUP" && order.storeLocation && appointment && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">In-store pickup</p>
              <p className="mt-1 text-sm font-medium">{order.storeLocation.name}</p>
              <p className="text-xs text-foreground/60">
                {order.storeLocation.address}, {order.storeLocation.city} — {order.storeLocation.pincode}
              </p>
              <p className="mt-2 text-sm">
                {new Date(appointment.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })} ·{" "}
                <span className="tabular-nums">{appointment.timeSlot}</span>{" "}
                <Badge variant={appointment.status === "READY" ? "success" : "outline"} className="ml-1">
                  {appointment.status.replaceAll("_", " ")}
                </Badge>
              </p>
              <p className="mt-2 text-xs text-foreground/50">Bring this QR code and a photo ID.</p>

              {appointmentActive && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" magnetic={false} onClick={() => setRescheduleOpen(true)}>
                    <CalendarClock className="h-3.5 w-3.5" /> Reschedule
                  </Button>
                  <Button size="sm" variant="ghost" magnetic={false} disabled={busy} onClick={handleCancel}>
                    <CalendarX2 className="h-3.5 w-3.5" /> Cancel pickup
                  </Button>
                  <Button size="sm" variant="ghost" magnetic={false} asChild>
                    <a href={`${API_URL}/api/appointments/${appointment._id}/ics`}>
                      <CalendarPlus className="h-3.5 w-3.5" /> Add to calendar
                    </a>
                  </Button>
                </div>
              )}
            </div>

            {appointmentActive && (
              <div className="rounded-xl bg-white p-3">
                <QRCode value={appointment.qrCode} size={110} />
                <p className="mt-1 text-center text-[10px] tracking-widest text-ink">{appointment.qrCode}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {order.deliveryMethod === "HOME" && order.shippingAddress && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Delivering to</p>
          <p className="mt-1 text-sm">{order.shippingAddress.name}</p>
          <p className="text-xs text-foreground/60">
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}, {order.shippingAddress.city},{" "}
            {order.shippingAddress.state} — {order.shippingAddress.pincode}
          </p>
        </div>
      )}

      <div className="mt-6 divide-y divide-border rounded-2xl border border-border px-4">
        {order.items.map((i, idx) => (
          <div key={idx} className="flex gap-3 py-3">
            <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-foreground/5">
              {i.image && <Image src={i.image} alt={i.name} fill className="object-cover" />}
            </div>
            <div className="flex-1">
              <p className="text-sm">{i.name}</p>
              <p className="text-xs text-foreground/50">
                {i.size} · {i.color} · Qty {i.qty}
              </p>
            </div>
            <p className="text-sm tabular-nums">₹{(i.price * i.qty).toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <CartSummary
          totals={{
            itemCount: 0,
            preTaxSubtotal: Math.round((order.pricing.subtotal - order.pricing.gst) * 100) / 100,
            gst: order.pricing.gst,
            subtotal: order.pricing.subtotal,
            discount: order.pricing.discount,
            shipping: order.pricing.shipping,
            freeShippingThreshold: 0,
            amountToFreeShipping: 0,
            total: order.pricing.total,
          }}
          coupon={order.coupon ?? null}
        />
      </div>

      {returns.length > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="font-display text-lg">Returns & refunds</h2>
          {returns.map((r) => (
            <ReturnCard key={r.id} refund={r} />
          ))}
        </section>
      )}

      <ReturnRequestModal
        open={returnOpen}
        onOpenChange={setReturnOpen}
        orderId={order._id}
        items={order.items}
        defaultPincode={order.shippingAddress?.pincode ?? order.storeLocation?.pincode}
        paymentMethod={paymentMethod}
        onCreated={load}
      />

      {order.storeLocation && (
        <Modal open={rescheduleOpen} onOpenChange={setRescheduleOpen} title="Reschedule pickup" className="max-w-xl">
          <SlotCalendar storeId={order.storeLocation._id} value={newSlot} onChange={setNewSlot} />
          <Button className="mt-4 w-full" disabled={!newSlot || busy} onClick={handleReschedule}>
            {busy ? "Saving…" : "Confirm new slot"}
          </Button>
        </Modal>
      )}
    </div>
  );
}
