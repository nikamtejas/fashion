"use client";

import * as React from "react";
import { PackageCheck, ScanLine } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

interface AgendaAppointment {
  _id: string;
  timeSlot: string;
  status: string;
  qrCode: string;
  storeLocation?: { name: string; city: string };
  order?: { orderNumber: string; pricing?: { total: number }; user?: { name?: string; email: string }; items?: { name: string; qty: number }[] };
}

const STATUS_VARIANT: Record<string, "success" | "outline" | "accent" | "default"> = {
  COMPLETED: "success",
  READY: "accent",
  BOOKED: "outline",
  NO_SHOW: "default",
  CANCELLED: "default",
};

export default function AdminPickupsPage() {
  const { toast } = useToast();
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [appointments, setAppointments] = React.useState<AgendaAppointment[] | null>(null);
  const [scanTarget, setScanTarget] = React.useState<AgendaAppointment | null>(null);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    setAppointments(null);
    apiFetch<{ appointments: AgendaAppointment[] }>(`/api/admin/pickups?date=${date}`).then((data) =>
      setAppointments(data.appointments)
    );
  }, [date]);

  React.useEffect(() => {
    // Refetch the agenda whenever the selected date changes (load is a
    // useCallback over `date`); setState happens in the async callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function markReady(a: AgendaAppointment) {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/pickups/${a._id}/ready`, { method: "POST" });
      toast({ title: "Marked ready — customer notified", variant: "success" });
      load();
    } catch (err) {
      toast({ title: "Couldn't mark ready", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    if (!scanTarget) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/pickups/${scanTarget._id}/complete`, { method: "POST", json: { qrCode: code } });
      toast({ title: "Pickup completed", variant: "success" });
      setScanTarget(null);
      setCode("");
      load();
    } catch (err) {
      toast({ title: "Couldn't complete", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Pickup agenda</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        />
      </div>

      {appointments === null && <p className="mt-8 text-sm text-foreground/50">Loading agenda…</p>}
      {appointments?.length === 0 && <p className="mt-8 text-sm text-foreground/50">No pickups on this day.</p>}

      <div className="mt-6 space-y-3">
        {appointments?.map((a) => (
          <div key={a._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
            <div>
              <p className="text-sm font-medium tabular-nums">
                {a.timeSlot} · {a.order?.orderNumber ?? "—"}
              </p>
              <p className="mt-0.5 text-xs text-foreground/50">
                {a.storeLocation?.name} · {a.order?.user?.email ?? "customer"} · ₹
                {a.order?.pricing?.total?.toLocaleString("en-IN") ?? "—"}
              </p>
              {a.order?.items && (
                <p className="mt-0.5 text-xs text-foreground/40">
                  {a.order.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[a.status] ?? "outline"}>{a.status.replaceAll("_", " ")}</Badge>
              {a.status === "BOOKED" && (
                <Button size="sm" variant="outline" magnetic={false} disabled={busy} onClick={() => markReady(a)}>
                  <PackageCheck className="h-3.5 w-3.5" /> Mark ready
                </Button>
              )}
              {["BOOKED", "READY"].includes(a.status) && (
                <Button size="sm" magnetic={false} disabled={busy} onClick={() => setScanTarget(a)}>
                  <ScanLine className="h-3.5 w-3.5" /> Scan QR
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={Boolean(scanTarget)}
        onOpenChange={(o) => !o && setScanTarget(null)}
        title={`Complete pickup ${scanTarget?.order?.orderNumber ?? ""}`}
        description="Scan or type the code shown on the customer's QR."
      >
        <Input
          label="Pickup code"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. 3F9A2C…"
        />
        <Button className="mt-4 w-full" disabled={busy || code.length < 4} onClick={complete}>
          {busy ? "Checking…" : "Complete pickup"}
        </Button>
      </Modal>
    </div>
  );
}
