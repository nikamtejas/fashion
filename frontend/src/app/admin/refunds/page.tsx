"use client";

import * as React from "react";
import { Banknote } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface PendingRefund {
  _id: string;
  method: string;
  amount: number;
  refundBankDetails?: { accountName?: string; accountNumber?: string; ifsc?: string };
  order?: { _id: string; orderNumber: string; user?: { email: string } };
}

interface CompletedRefund {
  _id: string;
  method: string;
  amount: number;
  refundedAt?: string;
  razorpayRefundId?: string;
  order?: { _id: string; orderNumber: string; user?: { email: string } };
}

export default function AdminRefundsPage() {
  const { toast } = useToast();
  const [payments, setPayments] = React.useState<PendingRefund[] | null>(null);
  const [completed, setCompleted] = React.useState<CompletedRefund[] | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    apiFetch<{ pending: PendingRefund[]; completed: CompletedRefund[] }>("/api/admin/orders/refunds").then((data) => {
      setPayments(data.pending);
      setCompleted(data.completed);
    });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function markPaid(orderId: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/orders/${orderId}/mark-refund-paid`, { method: "POST" });
      toast({ title: "Refund marked paid", variant: "success" });
      load();
    } catch (err) {
      toast({ title: "Couldn't mark as paid", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl">Refund payouts</h1>
      <p className="mt-1 text-sm text-foreground/50">
        Cancellation refunds with no automated refund rail (COD, cash, card, UPI) — pay these out by bank transfer, then mark them paid.
      </p>

      {payments === null && <p className="mt-8 text-sm text-foreground/50">Loading…</p>}
      {payments?.length === 0 && <p className="mt-8 text-sm text-foreground/50">No refunds awaiting payout.</p>}

      <div className="mt-6 space-y-3">
        {payments?.map((p) => {
          const details = p.refundBankDetails;
          const hasDetails = Boolean(details?.accountNumber);
          return (
            <div key={p._id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {p.order?.orderNumber} · ₹{p.amount.toLocaleString("en-IN")}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/50">
                    {p.order?.user?.email} · paid via {p.method}
                  </p>
                  {hasDetails ? (
                    <p className="mt-1 text-xs text-foreground/60">
                      {details!.accountName} · {details!.accountNumber} · {details!.ifsc}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-foreground/40">Waiting on the customer&apos;s bank details</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={hasDetails ? "accent" : "outline"}>{hasDetails ? "Ready to pay" : "Pending details"}</Badge>
                  <Button
                    size="sm"
                    magnetic={false}
                    disabled={busy || !hasDetails || !p.order}
                    onClick={() => markPaid(p.order!._id)}
                  >
                    <Banknote className="h-3.5 w-3.5" /> Mark as paid
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mt-10 font-display text-xl">Completed refunds</h2>
      <p className="mt-1 text-sm text-foreground/50">
        Cancellation refunds already settled — automatically via Razorpay/Snapmint, or manually paid out above.
      </p>

      {completed === null && <p className="mt-8 text-sm text-foreground/50">Loading…</p>}
      {completed?.length === 0 && <p className="mt-8 text-sm text-foreground/50">No completed refunds yet.</p>}

      <div className="mt-6 space-y-3">
        {completed?.map((p) => {
          const automatic = p.method === "RAZORPAY" || p.method === "SNAPMINT";
          return (
            <div key={p._id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {p.order?.orderNumber} · ₹{p.amount.toLocaleString("en-IN")}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/50">
                    {p.order?.user?.email} · paid via {p.method}
                  </p>
                  <p className="mt-1 text-xs text-foreground/60">
                    {p.method === "RAZORPAY" && p.razorpayRefundId
                      ? `Refunded automatically via Razorpay — ${p.razorpayRefundId}`
                      : p.method === "SNAPMINT"
                        ? "EMI cancelled automatically via Snapmint"
                        : "Paid out manually by admin"}
                    {p.refundedAt && ` · ${new Date(p.refundedAt).toLocaleString("en-IN")}`}
                  </p>
                </div>
                <Badge variant={automatic ? "success" : "outline"}>{automatic ? "Automatic" : "Manual"}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
