"use client";

import * as React from "react";
import Image from "next/image";
import { PackageCheck, ScanLine, Camera, Keyboard, BadgeCheck, Banknote, MailCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { QrCameraScanner } from "@/components/admin/QrCameraScanner";

interface AgendaAppointment {
  _id: string;
  timeSlot: string;
  status: string;
  qrCode: string;
  storeLocation?: { name: string; city: string };
  order?: { orderNumber: string; pricing?: { total: number }; user?: { name?: string; email: string }; items?: { name: string; qty: number }[] };
}

interface LookupResult {
  appointment: { _id: string; status: string; date: string; timeSlot: string; qrCode: string; store?: { name: string; city: string } };
  order: {
    _id: string;
    orderNumber: string;
    status: string;
    items: { name: string; size?: string; color?: string; qty: number; price: number; image?: string }[];
    total: number;
  };
  customer: { name?: string; email?: string; phone?: string };
  payment: { method: string; status: string; dueAmount: number };
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
  const [busy, setBusy] = React.useState(false);

  // Counter scan station
  const [stationCamera, setStationCamera] = React.useState(false);
  const [stationCode, setStationCode] = React.useState("");
  const [lookup, setLookup] = React.useState<LookupResult | null>(null);
  const [otpSentTo, setOtpSentTo] = React.useState<string | null>(null);
  const [otp, setOtp] = React.useState("");

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

  /** The scanner is one-shot: whatever the lookup outcome, the camera view
   * closes on scan and only reopens when the staff member taps it again. */
  function handleStationScan(text: string) {
    setStationCamera(false);
    runLookup(text);
  }

  /** Scanned or typed code → full order/payment details panel. */
  async function runLookup(raw: string) {
    const code = raw.trim().toUpperCase();
    if (code.length < 4) return;
    setBusy(true);
    try {
      const data = await apiFetch<LookupResult>(`/api/admin/pickups/lookup/${encodeURIComponent(code)}`);
      setLookup(data);
      setStationCamera(false);
      setStationCode("");
      setOtpSentTo(null);
      setOtp("");
    } catch (err) {
      toast({ title: "Code not found", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function completeHandover(body: { qrCode?: string; otp?: string }) {
    if (!lookup) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/pickups/${lookup.appointment._id}/complete`, { method: "POST", json: body });
      toast({ title: "Pickup completed — order marked delivered", variant: "success" });
      setLookup(null);
      load();
    } catch (err) {
      toast({ title: "Couldn't complete", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function sendHandoverOtp() {
    if (!lookup) return;
    setBusy(true);
    try {
      const data = await apiFetch<{ sentTo: string }>(`/api/admin/pickups/${lookup.appointment._id}/handover-otp`, {
        method: "POST",
      });
      setOtpSentTo(data.sentTo);
      toast({ title: "OTP emailed to the customer", description: data.sentTo, variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't send OTP", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  const actionable = lookup && ["BOOKED", "READY"].includes(lookup.appointment.status);

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

      {/* Counter scan station */}
      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-accent" />
          <p className="text-sm font-medium">Counter scan station</p>
        </div>
        <p className="mt-1 text-xs text-foreground/50">
          Scan any pickup QR — or type the code — to pull up the order, items, payment status and handover actions.
        </p>
        {stationCamera ? (
          <div className="mt-3 max-w-sm">
            <QrCameraScanner onScan={handleStationScan} />
            <Button variant="outline" magnetic={false} size="sm" className="mt-2 w-full" onClick={() => setStationCamera(false)}>
              <Keyboard className="h-3.5 w-3.5" /> Type the code instead
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runLookup(stationCode);
            }}
            className="mt-3 flex flex-wrap items-end gap-2"
          >
            <div className="min-w-48 flex-1 sm:max-w-xs">
              <Input
                value={stationCode}
                onChange={(e) => setStationCode(e.target.value.toUpperCase())}
                placeholder="Pickup code e.g. 3F9A2C…"
              />
            </div>
            <Button type="submit" magnetic={false} disabled={busy || stationCode.trim().length < 4}>
              Look up
            </Button>
            <Button type="button" variant="outline" magnetic={false} onClick={() => setStationCamera(true)}>
              <Camera className="h-4 w-4" /> Scan with camera
            </Button>
          </form>
        )}
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
              <Button size="sm" magnetic={false} disabled={busy} onClick={() => runLookup(a.qrCode)}>
                <ScanLine className="h-3.5 w-3.5" /> Details
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Handover details panel */}
      <Modal
        open={Boolean(lookup)}
        onOpenChange={(o) => !o && setLookup(null)}
        title={`Pickup — ${lookup?.order.orderNumber ?? ""}`}
        description={`${lookup?.appointment.store?.name ?? ""} · ${lookup ? new Date(lookup.appointment.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""} · ${lookup?.appointment.timeSlot ?? ""}`}
      >
        {lookup && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <p className="font-medium">{lookup.customer.name ?? "Customer"}</p>
                <p className="text-xs text-foreground/50">
                  {[lookup.customer.email, lookup.customer.phone].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[lookup.appointment.status] ?? "outline"}>
                {lookup.appointment.status.replaceAll("_", " ")}
              </Badge>
            </div>

            <div className="space-y-2 rounded-xl border border-border p-3">
              {lookup.order.items.map((i, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-foreground/5">
                    {i.image && <Image src={i.image} alt={i.name} fill className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{i.name}</p>
                    <p className="text-xs text-foreground/50">
                      {[i.size, i.color].filter(Boolean).join(" / ")} · ×{i.qty}
                    </p>
                  </div>
                  <p className="tabular-nums text-xs">₹{(i.price * i.qty).toLocaleString("en-IN")}</p>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-medium">
                <span>Total</span>
                <span className="tabular-nums">₹{lookup.order.total.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {lookup.payment.dueAmount > 0 ? (
              <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <Banknote className="h-4 w-4 shrink-0" />
                Cash on delivery — collect ₹{lookup.payment.dueAmount.toLocaleString("en-IN")} before handover.
              </p>
            ) : (
              <p className="flex items-center gap-2 rounded-xl bg-[var(--color-sage,#8a9b7d)]/15 p-3 text-sm text-[var(--color-sage-dark,#5c6e50)]">
                <BadgeCheck className="h-4 w-4 shrink-0" />
                Paid online via {lookup.payment.method} — nothing to collect.
              </p>
            )}

            {actionable ? (
              <div className="space-y-2">
                <Button
                  className="w-full"
                  magnetic={false}
                  disabled={busy}
                  onClick={() => completeHandover({ qrCode: lookup.appointment.qrCode })}
                >
                  <PackageCheck className="h-4 w-4" />
                  {busy ? "Working…" : lookup.payment.dueAmount > 0 ? "Cash collected — mark as done" : "Handed over — mark as done"}
                </Button>

                {otpSentTo ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      completeHandover({ otp });
                    }}
                    className="flex items-end gap-2"
                  >
                    <div className="flex-1">
                      <Input
                        label={`OTP emailed to ${otpSentTo}`}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="000000"
                        inputMode="numeric"
                        maxLength={6}
                        autoFocus
                      />
                    </div>
                    <Button type="submit" magnetic={false} disabled={busy || otp.trim().length < 4}>
                      Verify & done
                    </Button>
                  </form>
                ) : (
                  <Button variant="outline" magnetic={false} className="w-full" disabled={busy} onClick={sendHandoverOtp}>
                    <MailCheck className="h-4 w-4" /> Or send an OTP to the customer
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-center text-xs text-foreground/50">
                This appointment is {lookup.appointment.status.replaceAll("_", " ").toLowerCase()} — no handover actions.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
