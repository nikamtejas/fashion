"use client";

import * as React from "react";
import { CheckCircle2, XCircle, ScanLine, Banknote } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

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

  const load = React.useCallback(() => {
    apiFetch<{ returns: AdminReturn[] }>("/api/admin/returns").then((data) => setReturns(data.returns));
  }, []);

  React.useEffect(() => {
     
    load();
  }, [load]);

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
                  <Button size="sm" variant="outline" magnetic={false} disabled={busy} onClick={() => setQcTarget(r)}>
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
          <Input label="Return code (from QR)" autoFocus value={qcCode} onChange={(e) => setQcCode(e.target.value.toUpperCase())} />
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
    </div>
  );
}
