"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { CreditCard, CalendarRange } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface PaymentInfo {
  order: { id: string; orderNumber: string; status: string; total: number };
  payment: { method: string; status: string } | null;
  emiEligible: boolean;
  canRetry: boolean;
}

interface EmiPlan {
  tenureMonths: number;
  monthlyAmount: number;
  downPayment: number;
}

export default function RetryPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [info, setInfo] = React.useState<PaymentInfo | null>(null);
  const [method, setMethod] = React.useState<"RAZORPAY" | "SNAPMINT">("RAZORPAY");
  const [plans, setPlans] = React.useState<EmiPlan[]>([]);
  const [tenure, setTenure] = React.useState(3);
  const [busy, setBusy] = React.useState(false);
  const [mockModal, setMockModal] = React.useState(false);
  const [snapmintWait, setSnapmintWait] = React.useState(false);

  React.useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  React.useEffect(() => {
    if (!user) return;
    apiFetch<PaymentInfo>(`/api/payments/order/${id}`)
      .then((data) => {
        setInfo(data);
        if (data.emiEligible) {
          apiFetch<{ plans: EmiPlan[] }>(`/api/payments/emi-plans?amount=${data.order.total}`).then((d) =>
            setPlans(d.plans)
          );
        }
      })
      .catch(() => router.replace("/account/orders"));
  }, [user, id, router]);

  async function finish() {
    router.push(`/orders/${id}/confirmation`);
  }

  async function retry() {
    setBusy(true);
    try {
      if (method === "RAZORPAY") {
        const init = await apiFetch<{ mock: boolean }>(`/api/payments/retry/${id}`, {
          method: "POST",
          json: { method: "RAZORPAY" },
        });
        if (init.mock) {
          setMockModal(true);
          return;
        }
        toast({ title: "Live Razorpay retry needs real keys", variant: "error" });
      } else {
        await apiFetch(`/api/payments/retry/${id}`, { method: "POST", json: { method: "SNAPMINT", tenure } });
        setSnapmintWait(true);
        setTimeout(async () => {
          try {
            await apiFetch("/api/payments/snapmint/callback", { method: "POST", json: { orderId: id, status: "success" } });
            await finish();
          } catch (err) {
            setSnapmintWait(false);
            toast({ title: "EMI approval failed", description: err instanceof Error ? err.message : undefined, variant: "error" });
          }
        }, 3000);
      }
    } catch (err) {
      toast({ title: "Couldn't retry payment", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function mockPay(success: boolean) {
    setBusy(true);
    try {
      if (success) {
        const sig = await apiFetch<{ razorpayPaymentId: string; razorpaySignature: string }>(
          `/api/payments/razorpay/mock-pay/${id}`,
          { method: "POST" }
        );
        await apiFetch("/api/payments/razorpay/verify", { method: "POST", json: { orderId: id, ...sig } });
        await finish();
      } else {
        await apiFetch("/api/payments/razorpay/fail", { method: "POST", json: { orderId: id } });
        setMockModal(false);
        toast({ title: "Payment failed again", description: "You can keep retrying while your reservation holds.", variant: "error" });
      }
    } finally {
      setBusy(false);
    }
  }

  if (!info) return <div className="py-20 text-center text-sm text-foreground/50">Loading…</div>;

  if (!info.canRetry) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="font-display text-2xl">Nothing to pay</p>
        <p className="mt-2 text-sm text-foreground/60">
          Order {info.order.orderNumber} is {info.order.status.replaceAll("_", " ").toLowerCase()}.
        </p>
        <Button className="mt-6" onClick={() => router.push(`/account/orders/${id}`)}>
          View order
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl">Complete your payment</h1>
      <p className="mt-2 text-sm text-foreground/60">
        Order {info.order.orderNumber} · ₹{info.order.total.toLocaleString("en-IN")} — your items are reserved for a
        few more minutes.
      </p>

      <div className="mt-6 space-y-3">
        <button
          onClick={() => setMethod("RAZORPAY")}
          className={cn(
            "w-full rounded-xl border p-4 text-left",
            method === "RAZORPAY" ? "border-accent bg-accent/5" : "border-border"
          )}
        >
          <p className="flex items-center gap-2 text-sm font-medium">
            <CreditCard className="h-4 w-4" /> Pay online
          </p>
        </button>
        {info.emiEligible && (
          <button
            onClick={() => setMethod("SNAPMINT")}
            className={cn(
              "w-full rounded-xl border p-4 text-left",
              method === "SNAPMINT" ? "border-accent bg-accent/5" : "border-border"
            )}
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              <CalendarRange className="h-4 w-4" /> EMI with Snapmint
            </p>
          </button>
        )}
      </div>

      {method === "SNAPMINT" && plans.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {plans.map((p) => (
            <button
              key={p.tenureMonths}
              onClick={() => setTenure(p.tenureMonths)}
              className={cn(
                "rounded-xl border p-3 text-left text-xs",
                tenure === p.tenureMonths ? "border-accent bg-accent/10" : "border-border"
              )}
            >
              <p className="font-medium tabular-nums">₹{p.monthlyAmount.toLocaleString("en-IN")}/mo</p>
              <p className="mt-0.5 text-foreground/50">{p.tenureMonths} months</p>
            </button>
          ))}
        </div>
      )}

      <Button size="lg" className="mt-6 w-full" disabled={busy} onClick={retry}>
        {busy ? "Starting…" : "Retry payment"}
      </Button>

      <Modal
        open={mockModal}
        onOpenChange={(o) => !o && mockPay(false)}
        title="Razorpay Checkout (simulated)"
        description="INTEGRATIONS_MOCK is on."
      >
        <div className="flex gap-3">
          <Button className="flex-1" disabled={busy} onClick={() => mockPay(true)}>
            Simulate success
          </Button>
          <Button variant="outline" className="flex-1" magnetic={false} disabled={busy} onClick={() => mockPay(false)}>
            Simulate failure
          </Button>
        </div>
      </Modal>

      <Modal open={snapmintWait} onOpenChange={() => {}} title="Snapmint approval">
        <div className="flex flex-col items-center gap-3 py-4">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-foreground/60">Waiting for approval… (simulated)</p>
        </div>
      </Modal>
    </div>
  );
}
