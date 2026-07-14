"use client";

import * as React from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { CalendarPlus, CalendarX2, CalendarClock, Smartphone } from "lucide-react";
import { apiFetch, API_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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

interface OrderPayment {
  method: string;
  status: string;
  hasRefundBankDetails?: boolean;
  refundDestination?: { label: string; detail?: string };
}

/** Mirrors the messaging cancelOrder() sends by email — shown here too since
 * a cancellation refund isn't tracked by the returns/RefundRequest flow. */
function cancellationRefundMessage(order: OrderDetail, payment?: OrderPayment): string {
  if (!payment || payment.status === "PENDING" || payment.status === "FAILED") {
    return "This order was cancelled — no payment was collected, so no refund is due.";
  }
  const amount = `₹${order.pricing.total.toLocaleString("en-IN")}`;
  if (payment.status === "REFUND_PENDING") {
    return payment.hasRefundBankDetails
      ? `Refund of ${amount} is on its way — we'll credit it to your bank account within 3-5 business days.`
      : `We'll refund ${amount} to your bank account — add your details below to receive it.`;
  }
  // REFUNDED
  if (payment.method === "RAZORPAY") return `Refund of ${amount} processed — it should reflect within minutes.`;
  if (payment.method === "SNAPMINT") {
    return `Your EMI plan was cancelled — ${amount} in instalments already paid will be refunded within 5-7 business days.`;
  }
  return `Refund of ${amount} has been credited to your bank account.`;
}

interface Appointment {
  _id: string;
  date: string;
  timeSlot: string;
  status: string;
  qrCode: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
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
  const [payment, setPayment] = React.useState<OrderPayment | undefined>();
  const [payOnlineBusy, setPayOnlineBusy] = React.useState(false);
  const [mockModal, setMockModal] = React.useState(false);
  const [bankModalOpen, setBankModalOpen] = React.useState(false);
  const [bank, setBank] = React.useState({ accountName: "", accountNumber: "", ifsc: "" });
  const [bankBusy, setBankBusy] = React.useState(false);

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
    apiFetch<{ payment: OrderPayment | null }>(`/api/payments/order/${id}`)
      .then((data) => setPayment(data.payment ?? undefined))
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
      toast({ title: "Order cancelled", variant: "success" });
      load();
    } catch (err) {
      toast({ title: "Couldn't cancel", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelHomeOrder() {
    setBusy(true);
    try {
      await apiFetch(`/api/orders/${id}/cancel`, { method: "POST" });
      toast({ title: "Order cancelled", variant: "success" });
      load();
    } catch (err) {
      toast({ title: "Couldn't cancel", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function submitRefundBankDetails() {
    setBankBusy(true);
    try {
      await apiFetch(`/api/payments/order/${id}/refund-bank-details`, { method: "POST", json: bank });
      toast({ title: "Bank details received", description: "We'll credit your refund within 3-5 business days.", variant: "success" });
      setBankModalOpen(false);
      load();
    } catch (err) {
      toast({ title: "Couldn't save bank details", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBankBusy(false);
    }
  }

  async function verifyOnlinePayment(razorpayPaymentId: string, razorpaySignature: string) {
    await apiFetch(`/api/payments/cod/online-verify/${id}`, {
      method: "POST",
      json: { razorpayPaymentId, razorpaySignature },
    });
    toast({ title: "Paid online — thanks!", description: "No cash needed at the door.", variant: "success" });
    setMockModal(false);
    load();
  }

  async function payOnline() {
    setPayOnlineBusy(true);
    try {
      const init = await apiFetch<{
        razorpay: { orderId: string; keyId: string; amount: number; currency: string };
        mock: boolean;
      }>(`/api/payments/cod/online-init/${id}`, { method: "POST" });

      if (init.mock) {
        setMockModal(true);
        return;
      }

      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) throw new Error("Couldn't load Razorpay checkout");
      const rzp = new window.Razorpay({
        key: init.razorpay.keyId,
        amount: init.razorpay.amount,
        currency: init.razorpay.currency,
        order_id: init.razorpay.orderId,
        name: "LuxeLoom",
        handler: async (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await verifyOnlinePayment(response.razorpay_payment_id, response.razorpay_signature);
          } catch (err) {
            toast({ title: "Verification failed", description: err instanceof Error ? err.message : undefined, variant: "error" });
          }
        },
      });
      rzp.open();
    } catch (err) {
      toast({ title: "Couldn't start payment", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setPayOnlineBusy(false);
    }
  }

  async function mockPay() {
    setPayOnlineBusy(true);
    try {
      const sig = await apiFetch<{ razorpayPaymentId: string; razorpaySignature: string }>(
        `/api/payments/razorpay/mock-pay/${id}`,
        { method: "POST" }
      );
      await verifyOnlinePayment(sig.razorpayPaymentId, sig.razorpaySignature);
    } catch (err) {
      toast({ title: "Payment error", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setPayOnlineBusy(false);
    }
  }

  if (!order) return <div className="py-20 text-center text-sm text-foreground/50">Loading…</div>;

  const canCancelHome = order.deliveryMethod === "HOME" && ["PLACED", "CONFIRMED", "PACKED"].includes(order.status);
  const appointmentActive = appointment && ["BOOKED", "READY"].includes(appointment.status);
  const canPayOnline =
    payment?.method === "COD" &&
    payment?.status !== "PAID" &&
    ["OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl">{order.orderNumber}</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Placed {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={order.status === "DELIVERED" ? "success" : "outline"}>{order.status.replaceAll("_", " ")}</Badge>
          <Button size="sm" variant="outline" magnetic={false} onClick={() => router.push(`/track/${order._id}`)}>
            Track order
          </Button>
          {order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED" && (
            <Button size="sm" variant="ghost" magnetic={false} asChild>
              <a href={`${API_URL}/api/orders/${order._id}/invoice.pdf`} target="_blank" rel="noreferrer">
                Invoice
              </a>
            </Button>
          )}
          {order.status === "DELIVERED" && (
            <Button size="sm" magnetic={false} onClick={() => setReturnOpen(true)}>
              Return / refund
            </Button>
          )}
          {canCancelHome && (
            <Button size="sm" variant="ghost" magnetic={false} disabled={busy} onClick={handleCancelHomeOrder}>
              Cancel order
            </Button>
          )}
        </div>
      </div>

      {order.status === "PENDING_PAYMENT" && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
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

      {canPayOnline && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <p className="flex items-center gap-2 text-sm">
            <Smartphone className="h-4 w-4 shrink-0 text-accent" />
            Your order is {order.status === "DELIVERED" ? "delivered" : "out for delivery"} — pay online via
            UPI/card instead of handing over cash.
          </p>
          <Button size="sm" magnetic={false} disabled={payOnlineBusy} onClick={payOnline}>
            {payOnlineBusy ? "Starting…" : "Pay online"}
          </Button>
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

      {(returns.length > 0 || order.status === "CANCELLED") && (
        <section className="mt-6 space-y-3">
          <h2 className="font-display text-lg">Returns & refunds</h2>
          {order.status === "CANCELLED" && (
            <div className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Order cancelled</p>
                  <p className="mt-0.5 text-xs text-foreground/50">
                    {payment ? `Paid via ${payment.method}` : "No payment was collected"}
                  </p>
                </div>
                <Badge variant={payment?.status === "REFUNDED" ? "success" : payment?.status === "REFUND_PENDING" ? "accent" : "default"}>
                  {payment?.status === "REFUNDED" ? "Refunded" : payment?.status === "REFUND_PENDING" ? "Refund pending" : "No refund due"}
                </Badge>
              </div>
              <p className="mt-3 text-xs text-[var(--color-sage-dark)]">{cancellationRefundMessage(order, payment)}</p>
              {payment?.refundDestination && (
                <p className="mt-1 text-xs text-foreground/50">
                  {payment.refundDestination.label}
                  {payment.refundDestination.detail ? ` · ${payment.refundDestination.detail}` : ""}
                </p>
              )}
              {payment?.status === "REFUND_PENDING" && !payment.hasRefundBankDetails && (
                <Button size="sm" className="mt-3" magnetic={false} onClick={() => setBankModalOpen(true)}>
                  Add bank details
                </Button>
              )}
            </div>
          )}
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
        paymentMethod={payment?.method}
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

      <Modal
        open={mockModal}
        onOpenChange={setMockModal}
        title="Razorpay Checkout (simulated)"
        description="INTEGRATIONS_MOCK is on — this stands in for Razorpay's hosted payment window."
      >
        <Button className="w-full" disabled={payOnlineBusy} onClick={mockPay}>
          {payOnlineBusy ? "Paying…" : "Simulate successful payment"}
        </Button>
      </Modal>

      <Modal
        open={bankModalOpen}
        onOpenChange={setBankModalOpen}
        title="Where should we send your refund?"
        description="This order was paid in cash — add your bank account so we can credit the refund."
      >
        <div className="space-y-3">
          <Input label="Account holder name" value={bank.accountName} onChange={(e) => setBank((b) => ({ ...b, accountName: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Account number" value={bank.accountNumber} onChange={(e) => setBank((b) => ({ ...b, accountNumber: e.target.value }))} />
            <Input label="IFSC" value={bank.ifsc} onChange={(e) => setBank((b) => ({ ...b, ifsc: e.target.value.toUpperCase() }))} />
          </div>
          <Button
            className="w-full"
            disabled={bankBusy || !bank.accountName || !bank.accountNumber || !bank.ifsc}
            onClick={submitRefundBankDetails}
          >
            {bankBusy ? "Saving…" : "Submit bank details"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
