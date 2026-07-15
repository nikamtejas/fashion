"use client";

import * as React from "react";
import { CheckCircle2, XCircle, ScanLine, Banknote, Camera, Keyboard, PackageSearch, CalendarClock } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { QrCameraScanner } from "@/components/admin/QrCameraScanner";

interface EligibilityResult {
  order: {
    _id: string;
    orderNumber: string;
    status: string;
    deliveryMethod: string;
    items: { sku: string; name: string; size?: string; color?: string; qty: number; price: number; image?: string }[];
    total: number;
  };
  customer: { name?: string; email?: string; phone?: string };
  delivery: {
    deliveredAt: string | null;
    daysSinceDelivered: number | null;
    returnWindowDays: number;
    expiresAt: string | null;
    eligible: boolean;
    reason: string | null;
  };
  existingReturns: { id: string; status: string; method: string; refundAmount?: number; createdAt: string }[];
}

interface AdminReturn {
  _id: string;
  status: string;
  method: "COURIER" | "STORE";
  reason: string;
  refundAmount?: number;
  createdAt: string;
  order?: { orderNumber: string; user?: { email: string } };
  storeLocation?: { name: string };
  appointment?: { date: string; timeSlot: string; status: string };
  items: { sku: string; qty: number }[];
  bankDetails?: { accountName?: string };
}

export default function AdminReturnsPage() {
  const { toast } = useToast();
  const [returns, setReturns] = React.useState<AdminReturn[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [rejectTarget, setRejectTarget] = React.useState<AdminReturn | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [qcTarget, setQcTarget] = React.useState<AdminReturn | null>(null);
  const [qcCode, setQcCode] = React.useState("");
  const [qcNotes, setQcNotes] = React.useState("");
  const [qcCamera, setQcCamera] = React.useState(true);

  // Check return eligibility station
  const [checkCamera, setCheckCamera] = React.useState(false);
  const [checkCode, setCheckCode] = React.useState("");
  const [checking, setChecking] = React.useState(false);
  const [eligibility, setEligibility] = React.useState<EligibilityResult | null>(null);

  const load = React.useCallback(() => {
    apiFetch<{ returns: AdminReturn[] }>("/api/admin/returns").then((data) => setReturns(data.returns));
  }, []);

  React.useEffect(() => {
     
    load();
  }, [load]);

  async function checkEligibility(raw: string) {
    const code = raw.trim();
    if (code.length < 4) return;
    setChecking(true);
    setCheckCamera(false);
    try {
      const data = await apiFetch<EligibilityResult>(`/api/admin/orders/lookup/${encodeURIComponent(code)}`);
      setEligibility(data);
    } catch (err) {
      toast({
        title: "Couldn't find that order",
        description: err instanceof ApiError ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setChecking(false);
    }
  }

  async function act(path: string, json?: unknown, successMsg?: string) {
    setBusy(true);
    try {
      await apiFetch(path, { method: "POST", json });
      if (successMsg) toast({ title: successMsg, variant: "success" });
      load();
      return true;
    } catch (err) {
      toast({ title: "Action failed", description: err instanceof Error ? err.message : undefined, variant: "error" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl">Returns & refunds</h1>

      {/* Check return eligibility — scan the invoice QR (or type the order
          number) for a delivered order to see when it shipped and whether
          it's still inside the return window. Lookup only — doesn't start
          a return itself. */}
      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <PackageSearch className="h-4 w-4 text-accent" />
          <p className="text-sm font-medium">Check return eligibility</p>
        </div>
        <p className="mt-1 text-xs text-foreground/50">
          Scan the QR on the customer&rsquo;s invoice — or enter the order number — to see the delivery date and whether it&rsquo;s still inside the return window.
        </p>
        {checkCamera ? (
          <div className="mt-3 max-w-sm">
            <QrCameraScanner onScan={(text) => checkEligibility(text)} />
            <Button variant="outline" magnetic={false} size="sm" className="mt-2 w-full" onClick={() => setCheckCamera(false)}>
              <Keyboard className="h-3.5 w-3.5" /> Type the code instead
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              checkEligibility(checkCode);
            }}
            className="mt-3 flex flex-wrap items-end gap-2"
          >
            <div className="min-w-48 flex-1 sm:max-w-xs">
              <Input value={checkCode} onChange={(e) => setCheckCode(e.target.value)} placeholder="Order number, e.g. LL-XXXXX" />
            </div>
            <Button type="submit" magnetic={false} disabled={checking || checkCode.trim().length < 4}>
              {checking ? "Checking…" : "Check"}
            </Button>
            <Button type="button" variant="outline" magnetic={false} onClick={() => setCheckCamera(true)}>
              <Camera className="h-4 w-4" /> Scan
            </Button>
          </form>
        )}
      </div>

      {returns === null && <p className="mt-8 text-sm text-foreground/50">Loading…</p>}
      {returns?.length === 0 && <p className="mt-8 text-sm text-foreground/50">No return requests.</p>}

      <div className="mt-6 space-y-3">
        {returns?.map((r) => (
          <div key={r._id} className="rounded-2xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {r.order?.orderNumber} · ₹{r.refundAmount?.toLocaleString("en-IN")}
                </p>
                <p className="mt-0.5 text-xs text-foreground/50">
                  {r.order?.user?.email} · {r.method === "STORE" ? `Drop-off at ${r.storeLocation?.name}` : "Courier reverse pickup"} ·{" "}
                  {r.items.reduce((s, i) => s + i.qty, 0)} item(s)
                </p>
                <p className="mt-1 text-xs text-foreground/60">&ldquo;{r.reason}&rdquo;</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.status === "REFUNDED" ? "success" : r.status === "REJECTED" ? "default" : "accent"}>
                  {r.status.replaceAll("_", " ")}
                </Badge>
                {r.status === "REQUESTED" && (
                  <>
                    <Button size="sm" magnetic={false} disabled={busy} onClick={() => act(`/api/admin/returns/${r._id}/approve`, undefined, "Return approved")}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="ghost" magnetic={false} disabled={busy} onClick={() => setRejectTarget(r)}>
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </>
                )}
                {r.method === "STORE" && ["REQUESTED", "APPROVED"].includes(r.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    magnetic={false}
                    disabled={busy}
                    onClick={() => {
                      setQcTarget(r);
                      setQcCamera(true);
                      setQcCode("");
                      setQcNotes("");
                    }}
                  >
                    <ScanLine className="h-3.5 w-3.5" /> Scan & QC
                  </Button>
                )}
                {r.status === "RECEIVED" && (
                  <Button size="sm" magnetic={false} disabled={busy} onClick={() => act(`/api/admin/returns/${r._id}/refund`, undefined, "Refund processed")}>
                    <Banknote className="h-3.5 w-3.5" /> Process refund
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={Boolean(rejectTarget)} onOpenChange={(o) => !o && setRejectTarget(null)} title="Reject return">
        <Input label="Reason shown to the customer" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        <Button
          className="mt-4 w-full"
          disabled={busy || rejectReason.trim().length < 3}
          onClick={async () => {
            if (await act(`/api/admin/returns/${rejectTarget!._id}/reject`, { reason: rejectReason }, "Return rejected")) {
              setRejectTarget(null);
              setRejectReason("");
            }
          }}
        >
          Reject return
        </Button>
      </Modal>

      <Modal
        open={Boolean(qcTarget)}
        onOpenChange={(o) => !o && setQcTarget(null)}
        title="In-store QC"
        description="Scan the customer's return QR, inspect the item, then pass or fail."
      >
        <div className="space-y-3">
          {qcCamera ? (
            <div>
              <QrCameraScanner onScan={(text) => { setQcCode(text.trim().toUpperCase()); setQcCamera(false); }} />
              <Button variant="outline" magnetic={false} size="sm" className="mt-2 w-full" onClick={() => setQcCamera(false)}>
                <Keyboard className="h-3.5 w-3.5" /> Type the code instead
              </Button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input label="Return code (from QR)" autoFocus value={qcCode} onChange={(e) => setQcCode(e.target.value.toUpperCase())} />
              </div>
              <Button type="button" variant="outline" magnetic={false} onClick={() => setQcCamera(true)}>
                <Camera className="h-4 w-4" /> Scan
              </Button>
            </div>
          )}
          <Input label="Notes (optional)" value={qcNotes} onChange={(e) => setQcNotes(e.target.value)} />
          <div className="flex gap-3">
            <Button
              className="flex-1"
              disabled={busy || qcCode.length < 4}
              onClick={async () => {
                if (await act(`/api/admin/returns/${qcTarget!._id}/qc`, { qrCode: qcCode, pass: true, notes: qcNotes }, "QC passed — refund processed")) {
                  setQcTarget(null);
                  setQcCode("");
                  setQcNotes("");
                }
              }}
            >
              Pass — refund now
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              magnetic={false}
              disabled={busy || qcCode.length < 4}
              onClick={async () => {
                if (await act(`/api/admin/returns/${qcTarget!._id}/qc`, { qrCode: qcCode, pass: false, notes: qcNotes }, "QC failed — return rejected")) {
                  setQcTarget(null);
                  setQcCode("");
                  setQcNotes("");
                }
              }}
            >
              Fail
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(eligibility)}
        onOpenChange={(o) => !o && setEligibility(null)}
        title={eligibility ? `Order ${eligibility.order.orderNumber}` : ""}
        description={eligibility?.customer.name ? `${eligibility.customer.name} · ${eligibility.customer.email ?? ""}` : eligibility?.customer.email}
      >
        {eligibility && (
          <div className="space-y-4">
            <div
              className={
                eligibility.delivery.eligible
                  ? "flex items-start gap-2 rounded-xl bg-[var(--color-sage,#8a9b7d)]/15 p-3 text-sm text-[var(--color-sage-dark,#5c6e50)]"
                  : "flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400"
              }
            >
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                {eligibility.delivery.eligible ? (
                  <p className="font-medium">
                    Eligible for return — delivered {eligibility.delivery.daysSinceDelivered} day
                    {eligibility.delivery.daysSinceDelivered === 1 ? "" : "s"} ago
                  </p>
                ) : (
                  <p className="font-medium">Not eligible — {eligibility.delivery.reason}</p>
                )}
                {eligibility.delivery.deliveredAt && (
                  <p className="mt-0.5 text-xs opacity-80">
                    Delivered {new Date(eligibility.delivery.deliveredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {eligibility.delivery.expiresAt &&
                      ` · return window ${eligibility.delivery.eligible ? "closes" : "closed"} ${new Date(eligibility.delivery.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border p-3">
              {eligibility.order.items.map((i, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div>
                    <p>{i.name}</p>
                    <p className="text-xs text-foreground/50">
                      {[i.size, i.color].filter(Boolean).join(" / ")} · ×{i.qty}
                    </p>
                  </div>
                  <p className="tabular-nums text-xs">₹{(i.price * i.qty).toLocaleString("en-IN")}</p>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-medium">
                <span>Total</span>
                <span className="tabular-nums">₹{eligibility.order.total.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {eligibility.existingReturns.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">Existing return requests</p>
                <div className="mt-2 space-y-2">
                  {eligibility.existingReturns.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                      <span>
                        {r.method === "STORE" ? "Store drop-off" : "Courier pickup"} ·{" "}
                        {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                      <Badge variant={r.status === "REFUNDED" ? "success" : r.status === "REJECTED" ? "default" : "accent"}>
                        {r.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
