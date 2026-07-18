"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Banknote, CalendarRange, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useCartStore } from "@/store/cartStore";
import { cn } from "@/lib/utils";
import { Coins } from "lucide-react";

interface EmiPlan {
  tenureMonths: number;
  monthlyAmount: number;
  downPayment: number;
  totalPayable: number;
}

export interface CheckoutPayload {
  deliveryMethod: "HOME" | "PICKUP";
  addressId?: string;
  storeId?: string;
  appointment?: { date: string; timeSlot: string };
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

export function PaymentStep({
  payload,
  total,
  onBack,
}: {
  payload: CheckoutPayload;
  total: number;
  onBack: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const refreshCart = useCartStore((s) => s.refresh);

  const [method, setMethod] = React.useState<"RAZORPAY" | "COD" | "SNAPMINT">("RAZORPAY");
  const [busy, setBusy] = React.useState(false);
  const [emiPlans, setEmiPlans] = React.useState<EmiPlan[] | null>(null);
  const [tenure, setTenure] = React.useState<number>(3);
  const [codSettings, setCodSettings] = React.useState<{ fee: number; max: number } | null>(null);
  const [codOtpSent, setCodOtpSent] = React.useState(false);
  const [codOtp, setCodOtp] = React.useState("");
  const [mockModal, setMockModal] = React.useState<{ orderId: string } | null>(null);
  const [snapmintWait, setSnapmintWait] = React.useState<{ orderId: string } | null>(null);
  const [failedOrderId, setFailedOrderId] = React.useState<string | null>(null);
  const [loyaltyBalance, setLoyaltyBalance] = React.useState(0);
  const [useLoyalty, setUseLoyalty] = React.useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = React.useState(0);

  React.useEffect(() => {
    apiFetch<{ eligible: boolean; plans: EmiPlan[] }>(`/api/payments/emi-plans?amount=${total}`)
      .then((d) => setEmiPlans(d.eligible ? d.plans : []))
      .catch(() => setEmiPlans([]));
    // COD constraints surface in the option copy.
    apiFetch<{ codConvenienceFee: number; codMaxOrderValue: number }>("/api/payments/checkout-settings")
      .then((d) => setCodSettings({ fee: d.codConvenienceFee, max: d.codMaxOrderValue }))
      .catch(() => setCodSettings(null));
    apiFetch<{ points: number }>("/api/loyalty")
      .then((d) => {
        setLoyaltyBalance(d.points);
        setLoyaltyPoints(Math.min(d.points, Math.max(0, Math.floor(total - 1))));
      })
      .catch(() => setLoyaltyBalance(0));
  }, [total]);

  const emiEligible = (emiPlans?.length ?? 0) > 0;
  // codSettings === null (still loading) defaults *permissive* so the card
  // doesn't flash disabled before settling — but nothing reset `method` if
  // it settled to ineligible after a user selected COD during that window,
  // so requestCodOtp/placeCod (gated only on method === "COD") could still
  // be reached. The backend's own codMaxOrderValue check would ultimately
  // reject it, but only after the user already went through OTP — auto-
  // switching away is a real fix, not just a defensive backstop.
  const codEligible = codSettings === null || total <= codSettings.max;
  React.useEffect(() => {
    if (method === "COD" && codSettings !== null && !codEligible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMethod("RAZORPAY");
      toast({
        title: "Cash on Delivery isn't available for this order",
        description: `It's only offered on orders up to ₹${codSettings.max.toLocaleString("en-IN")}.`,
        variant: "error",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codEligible, codSettings, method]);
  const redeemedPoints = useLoyalty ? Math.min(loyaltyPoints, loyaltyBalance, Math.max(0, Math.floor(total - 1))) : 0;
  const payable = Math.round((total - redeemedPoints) * 100) / 100;

  async function finish(orderId: string) {
    await refreshCart();
    router.push(`/orders/${orderId}/confirmation`);
  }

  // ─── Razorpay ─────────────────────────────────────────────────────────

  async function payWithRazorpay() {
    setBusy(true);
    try {
      const init = await apiFetch<{
        orderId: string;
        razorpay: { orderId: string; keyId: string; amount: number; currency: string };
        mock: boolean;
      }>("/api/payments/razorpay/initiate", { method: "POST", json: { ...payload, loyaltyPoints: redeemedPoints } });

      if (init.mock) {
        setMockModal({ orderId: init.orderId });
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
            await apiFetch("/api/payments/razorpay/verify", {
              method: "POST",
              json: {
                orderId: init.orderId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              },
            });
            await finish(init.orderId);
          } catch (err) {
            toast({ title: "Verification failed", description: err instanceof Error ? err.message : undefined, variant: "error" });
            setFailedOrderId(init.orderId);
          }
        },
        modal: {
          ondismiss: async () => {
            await apiFetch("/api/payments/razorpay/fail", { method: "POST", json: { orderId: init.orderId } }).catch(() => {});
            setFailedOrderId(init.orderId);
          },
        },
      });
      rzp.open();
    } catch (err) {
      toast({ title: "Couldn't start payment", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function mockPay(success: boolean) {
    if (!mockModal) return;
    setBusy(true);
    try {
      if (success) {
        const sig = await apiFetch<{ razorpayPaymentId: string; razorpaySignature: string }>(
          `/api/payments/razorpay/mock-pay/${mockModal.orderId}`,
          { method: "POST" }
        );
        await apiFetch("/api/payments/razorpay/verify", {
          method: "POST",
          json: { orderId: mockModal.orderId, ...sig },
        });
        await finish(mockModal.orderId);
      } else {
        await apiFetch("/api/payments/razorpay/fail", { method: "POST", json: { orderId: mockModal.orderId } });
        setFailedOrderId(mockModal.orderId);
        setMockModal(null);
        await refreshCart();
      }
    } catch (err) {
      toast({ title: "Payment error", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  // ─── COD ──────────────────────────────────────────────────────────────

  async function requestCodOtp() {
    setBusy(true);
    try {
      await apiFetch("/api/payments/cod/request-otp", { method: "POST" });
      setCodOtpSent(true);
      toast({ title: "Confirmation code sent", description: "Check your email for the 6-digit code." });
    } catch (err) {
      toast({ title: "Couldn't send code", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function placeCod() {
    setBusy(true);
    try {
      const data = await apiFetch<{ order: { _id: string } }>("/api/payments/cod/place", {
        method: "POST",
        json: { ...payload, otp: codOtp, loyaltyPoints: redeemedPoints },
      });
      await finish(data.order._id);
    } catch (err) {
      toast({ title: "Couldn't place order", description: err instanceof Error ? err.message : undefined, variant: "error" });
      setBusy(false);
    }
  }

  // ─── Snapmint ─────────────────────────────────────────────────────────

  async function payWithSnapmint() {
    setBusy(true);
    try {
      const init = await apiFetch<{ orderId: string; mock: boolean }>("/api/payments/snapmint/initiate", {
        method: "POST",
        json: { ...payload, tenure, loyaltyPoints: redeemedPoints },
      });
      setSnapmintWait({ orderId: init.orderId });
      // MOCK: Snapmint "approves" after ~3 seconds.
      setTimeout(async () => {
        try {
          await apiFetch("/api/payments/snapmint/callback", {
            method: "POST",
            json: { orderId: init.orderId, status: "success" },
          });
          await finish(init.orderId);
        } catch (err) {
          toast({ title: "EMI approval failed", description: err instanceof Error ? err.message : undefined, variant: "error" });
          setSnapmintWait(null);
          setFailedOrderId(init.orderId);
        }
      }, 3000);
    } catch (err) {
      toast({ title: "Couldn't start EMI", description: err instanceof Error ? err.message : undefined, variant: "error" });
      setBusy(false);
    }
  }

  if (failedOrderId) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/30">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">Payment didn&rsquo;t go through</p>
        <p className="mt-1 text-xs text-foreground/60">
          Your order is saved and your items are reserved for 15 minutes. You can retry now or later from your orders.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Button size="sm" onClick={() => router.push(`/orders/${failedOrderId}/pay`)}>
            Retry payment
          </Button>
          <Button size="sm" variant="outline" magnetic={false} onClick={() => router.push("/account/orders")}>
            My orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <MethodCard
          selected={method === "RAZORPAY"}
          onSelect={() => setMethod("RAZORPAY")}
          icon={<CreditCard className="h-4 w-4" />}
          title="Pay online"
          subtitle="Cards, UPI, netbanking & wallets via Razorpay"
        />
        <MethodCard
          selected={method === "COD"}
          onSelect={() => codEligible && setMethod("COD")}
          disabled={!codEligible}
          icon={<Banknote className="h-4 w-4" />}
          title="Cash on Delivery"
          subtitle={
            !codEligible
              ? `Available on orders up to ₹${codSettings?.max.toLocaleString("en-IN")}`
              : codSettings?.fee
                ? `₹${codSettings.fee} convenience fee applies`
                : "Pay when your order arrives"
          }
        />
        {/* Reserving the EMI card's space with a skeleton while eligibility
            is unknown (rather than nothing) means the two cards above don't
            visibly shift down once the eligibility check resolves. */}
        {emiPlans === null ? (
          <Skeleton className="h-[68px] w-full rounded-xl" />
        ) : (
          emiEligible && (
            <MethodCard
              selected={method === "SNAPMINT"}
              onSelect={() => setMethod("SNAPMINT")}
              icon={<CalendarRange className="h-4 w-4" />}
              title="EMI with Snapmint"
              subtitle={`From ₹${Math.min(...emiPlans!.map((p) => p.monthlyAmount)).toLocaleString("en-IN")}/month`}
            />
          )
        )}
      </div>

      {method === "SNAPMINT" && emiEligible && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Pick your plan</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {emiPlans!.map((p) => (
              <button
                key={p.tenureMonths}
                onClick={() => setTenure(p.tenureMonths)}
                className={cn(
                  "rounded-xl border p-3 text-left text-xs",
                  tenure === p.tenureMonths ? "border-accent bg-accent/10" : "border-border"
                )}
              >
                <p className="font-medium tabular-nums">₹{p.monthlyAmount.toLocaleString("en-IN")}/mo</p>
                <p className="mt-0.5 text-foreground/50">
                  {p.tenureMonths} months{p.downPayment > 0 ? ` · ₹${p.downPayment} down` : " · no down payment"}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {method === "COD" && codOtpSent && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <Input
            label="6-digit confirmation code"
            inputMode="numeric"
            maxLength={6}
            value={codOtp}
            onChange={(e) => setCodOtp(e.target.value)}
            placeholder="000000"
          />
        </div>
      )}

      {loyaltyBalance > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useLoyalty} onChange={(e) => setUseLoyalty(e.target.checked)} />
            <Coins className="h-4 w-4 text-sienna" />
            Use loyalty points <span className="text-xs text-foreground/50">(balance: {loyaltyBalance} · 1 pt = ₹1)</span>
          </label>
          {useLoyalty && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="number"
                min={0}
                max={Math.min(loyaltyBalance, Math.floor(total - 1))}
                value={loyaltyPoints}
                onChange={(e) => setLoyaltyPoints(Number(e.target.value) || 0)}
                className="h-9 w-28 rounded-lg border border-border bg-background px-2 tabular-nums"
                aria-label="Points to redeem"
              />
              <span className="text-xs text-foreground/50">
                −₹{redeemedPoints.toLocaleString("en-IN")} → you pay ₹{payable.toLocaleString("en-IN")}
              </span>
            </div>
          )}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-foreground/40">
        <ShieldCheck className="h-3.5 w-3.5" /> Payments are verified server-side; your items stay reserved while you pay.
      </p>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" magnetic={false} onClick={onBack} disabled={busy}>
          Back
        </Button>
        {method === "RAZORPAY" && (
          <Button size="lg" disabled={busy} onClick={payWithRazorpay}>
            {busy ? "Starting…" : `Pay ₹${payable.toLocaleString("en-IN")}`}
          </Button>
        )}
        {method === "COD" &&
          (codOtpSent ? (
            <Button size="lg" disabled={busy || codOtp.length < 6} onClick={placeCod}>
              {busy ? "Placing…" : "Confirm & place order"}
            </Button>
          ) : (
            <Button size="lg" disabled={busy} onClick={requestCodOtp}>
              {busy ? "Sending…" : "Send confirmation code"}
            </Button>
          ))}
        {method === "SNAPMINT" && (
          <Button size="lg" disabled={busy} onClick={payWithSnapmint}>
            {busy ? "Starting…" : `Continue with ${tenure}-month EMI`}
          </Button>
        )}
      </div>

      {/* Simulated Razorpay checkout for INTEGRATIONS_MOCK mode */}
      <Modal
        open={Boolean(mockModal)}
        onOpenChange={(o) => !o && mockModal && mockPay(false)}
        title="Razorpay Checkout (simulated)"
        description="INTEGRATIONS_MOCK is on — this stands in for Razorpay's hosted payment window."
      >
        <p className="text-sm text-foreground/60">
          Paying <span className="font-medium text-foreground">₹{total.toLocaleString("en-IN")}</span> to LuxeLoom
        </p>
        <div className="mt-5 flex gap-3">
          <Button className="flex-1" disabled={busy} onClick={() => mockPay(true)}>
            {busy ? "Verifying…" : "Simulate success"}
          </Button>
          <Button variant="outline" className="flex-1" magnetic={false} disabled={busy} onClick={() => mockPay(false)}>
            Simulate failure
          </Button>
        </div>
      </Modal>

      {/* Snapmint approval wait */}
      <Modal open={Boolean(snapmintWait)} onOpenChange={() => {}} title="Snapmint approval">
        <div className="flex flex-col items-center gap-3 py-4">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-foreground/60">Waiting for Snapmint to approve your EMI…</p>
          <p className="text-xs text-foreground/40">(simulated — approves in about 3 seconds)</p>
        </div>
      </Modal>
    </div>
  );
}

function MethodCard({
  selected,
  onSelect,
  icon,
  title,
  subtitle,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-colors",
        selected ? "border-accent bg-accent/5" : "border-border",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        {icon} {title}
      </p>
      <p className="mt-1 text-xs text-foreground/60">{subtitle}</p>
    </button>
  );
}
