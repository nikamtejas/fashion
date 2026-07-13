"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface OutstandingRow {
  paymentId: string;
  order?: { _id: string; orderNumber: string; deliveryMethod: string };
  amount: number;
  codCollectedAt?: string;
  daysOutstanding: number;
  overdue: boolean;
}

interface OutstandingResponse {
  rows: OutstandingRow[];
  totalOutstanding: number;
  overdueCount: number;
  overdueAmount: number;
}

interface RemittanceRow {
  _id: string;
  courier: string;
  reference: string;
  amount: number;
  courierFee: number;
  remittedAt: string;
  payments: { amount: number; order?: { orderNumber: string } }[];
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AdminCodRemittancePage() {
  const { toast } = useToast();
  const [outstanding, setOutstanding] = React.useState<OutstandingResponse | null>(null);
  const [history, setHistory] = React.useState<RemittanceRow[] | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const [form, setForm] = React.useState({
    courier: "Blue Dart (DHL)",
    reference: "",
    amount: "",
    courierFee: "0",
    remittedAt: todayStr(),
    notes: "",
  });

  const load = React.useCallback(() => {
    setOutstanding(null);
    setHistory(null);
    setSelected(new Set());
    apiFetch<OutstandingResponse>("/api/admin/cod-remittance/outstanding").then(setOutstanding);
    apiFetch<{ remittances: RemittanceRow[] }>("/api/admin/cod-remittance").then((d) => setHistory(d.remittances));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openModal() {
    const selectedTotal = outstanding?.rows.filter((r) => selected.has(r.paymentId)).reduce((s, r) => s + r.amount, 0) ?? 0;
    setForm((f) => ({ ...f, amount: selectedTotal ? String(selectedTotal) : f.amount }));
    setModalOpen(true);
  }

  async function submitRemittance() {
    setBusy(true);
    try {
      const result = await apiFetch<{ matchedCount: number; matchedTotal: number; varianceFromReported: number }>(
        "/api/admin/cod-remittance",
        {
          method: "POST",
          json: {
            courier: form.courier,
            reference: form.reference.trim(),
            amount: Number(form.amount),
            courierFee: Number(form.courierFee || 0),
            remittedAt: form.remittedAt,
            paymentIds: [...selected],
            notes: form.notes.trim() || undefined,
          },
        }
      );
      const variance = result.varianceFromReported;
      toast({
        title: `Remittance logged — ${result.matchedCount} order${result.matchedCount === 1 ? "" : "s"} settled`,
        description:
          Math.abs(variance) > 0.5
            ? `Reported amount is ₹${variance > 0 ? variance.toLocaleString("en-IN") : Math.abs(variance).toLocaleString("en-IN")} ${variance > 0 ? "more" : "short"} than the matched orders sum to — worth checking.`
            : undefined,
        variant: Math.abs(variance) > 0.5 ? "error" : "success",
      });
      setModalOpen(false);
      setForm({ courier: "Blue Dart (DHL)", reference: "", amount: "", courierFee: "0", remittedAt: todayStr(), notes: "" });
      load();
    } catch (err) {
      toast({ title: "Couldn't log remittance", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  const selectedTotal = outstanding?.rows.filter((r) => selected.has(r.paymentId)).reduce((s, r) => s + r.amount, 0) ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">COD remittance</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Cash the courier collected at the door but hasn&apos;t yet credited to our bank account.
          </p>
        </div>
      </div>

      {outstanding && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border p-4">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-foreground/50">
              <Banknote className="h-3.5 w-3.5" /> With courier, awaiting remittance
            </p>
            <p className="mt-1 font-display text-2xl">₹{outstanding.totalOutstanding.toLocaleString("en-IN")}</p>
            <p className="mt-0.5 text-xs text-foreground/50">{outstanding.rows.length} orders</p>
          </div>
          <div
            className={`rounded-2xl border p-4 ${
              outstanding.overdueCount > 0 ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" : "border-border"
            }`}
          >
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-foreground/50">
              <AlertTriangle className="h-3.5 w-3.5" /> Overdue (7+ days, not yet remitted)
            </p>
            <p className="mt-1 font-display text-2xl">₹{outstanding.overdueAmount.toLocaleString("en-IN")}</p>
            <p className="mt-0.5 text-xs text-foreground/50">{outstanding.overdueCount} orders — worth chasing the courier</p>
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent/5 px-4 py-2 text-sm">
          <span>
            {selected.size} selected · ₹{selectedTotal.toLocaleString("en-IN")}
          </span>
          <Button size="sm" magnetic={false} onClick={openModal}>
            Log remittance for selection
          </Button>
        </div>
      )}

      <h2 className="mt-8 font-display text-lg">Outstanding orders</h2>
      {outstanding === null && <Skeleton className="mt-3 h-40 w-full" />}
      {outstanding?.rows.length === 0 && (
        <p className="mt-4 flex items-center gap-2 text-sm text-foreground/50">
          <CheckCircle2 className="h-4 w-4 text-sage" /> Nothing outstanding — every COD order has been remitted.
        </p>
      )}
      {outstanding && outstanding.rows.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wider text-foreground/50">
              <tr>
                <th className="w-8 px-3 py-3" />
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Collected</th>
                <th className="px-4 py-3">Age</th>
              </tr>
            </thead>
            <tbody>
              {outstanding.rows.map((r) => (
                <tr key={r.paymentId} className="border-t border-border hover:bg-foreground/5">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.paymentId)}
                      onChange={() => toggle(r.paymentId)}
                      aria-label={`Select ${r.order?.orderNumber ?? r.paymentId}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {r.order ? (
                      <Link href={`/admin/orders/${r.order._id}`} className="font-medium hover:underline">
                        {r.order.orderNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/60">{r.order?.deliveryMethod === "PICKUP" ? "Pickup" : "Home"}</td>
                  <td className="px-4 py-3 tabular-nums">₹{r.amount.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-foreground/60">
                    {r.codCollectedAt ? new Date(r.codCollectedAt).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={r.overdue ? "outline" : "default"} className={r.overdue ? "border-amber-400 text-amber-700 dark:text-amber-400" : ""}>
                      {r.daysOutstanding}d
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-10 font-display text-lg">Remittance history</h2>
      {history === null && <Skeleton className="mt-3 h-32 w-full" />}
      {history?.length === 0 && <p className="mt-4 text-sm text-foreground/50">No remittances logged yet.</p>}
      {history && history.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wider text-foreground/50">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Courier</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Courier fee</th>
                <th className="px-4 py-3">Amount received</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r._id} className="border-t border-border">
                  <td className="px-4 py-2.5 text-foreground/60">{new Date(r.remittedAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-2.5">{r.courier}</td>
                  <td className="px-4 py-2.5 text-foreground/60">{r.reference}</td>
                  <td className="px-4 py-2.5 text-foreground/60">{r.payments.length}</td>
                  <td className="px-4 py-2.5 tabular-nums text-foreground/60">₹{r.courierFee.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 tabular-nums font-medium">₹{r.amount.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Log a COD remittance"
        description="Enter what the courier's remittance report says, matched against the orders it covers."
      >
        <div className="space-y-3">
          <Input
            label="Courier"
            value={form.courier}
            onChange={(e) => setForm((f) => ({ ...f, courier: e.target.value }))}
          />
          <Input
            label="Reference / UTR number"
            value={form.reference}
            onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
            placeholder="e.g. UTR2026071300123"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount received (₹)"
              type="number"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
            <Input
              label="Courier fee deducted (₹)"
              type="number"
              inputMode="decimal"
              value={form.courierFee}
              onChange={(e) => setForm((f) => ({ ...f, courierFee: e.target.value }))}
            />
          </div>
          <Input
            label="Remitted on"
            type="date"
            value={form.remittedAt}
            onChange={(e) => setForm((f) => ({ ...f, remittedAt: e.target.value }))}
          />
          <Input label="Notes (optional)" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />

          <p className="text-xs text-foreground/50">
            Covers {selected.size} order{selected.size === 1 ? "" : "s"} totalling ₹{selectedTotal.toLocaleString("en-IN")}.
          </p>

          <Button
            className="w-full"
            disabled={busy || !form.reference.trim() || !form.amount || selected.size === 0}
            onClick={submitRemittance}
          >
            {busy ? "Saving…" : "Log remittance"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
