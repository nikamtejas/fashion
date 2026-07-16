"use client";

import * as React from "react";
import { Plus, CheckCircle2, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn, normalizeIndianPhone } from "@/lib/utils";
import type { SavedAddress, AddressForm } from "./types";

const EMPTY_FORM: AddressForm = {
  label: "Home",
  name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

export function AddressStep({
  onContinue,
}: {
  onContinue: (sel: { addressId?: string; address?: AddressForm; pincode: string }) => void;
}) {
  const { toast } = useToast();
  const [addresses, setAddresses] = React.useState<SavedAddress[] | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState<AddressForm>(EMPTY_FORM);
  const [serviceability, setServiceability] = React.useState<{ pincode: string; serviceable: boolean; etaDays?: number; message?: string } | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    apiFetch<{ addresses: SavedAddress[] }>("/api/addresses").then((data) => {
      setAddresses(data.addresses);
      const def = data.addresses.find((a) => a.isDefault) ?? data.addresses[0];
      if (def) {
        setSelectedId(def._id);
        checkServiceability(def.pincode);
      } else {
        setShowForm(true);
      }
    });
  }, []);

  async function checkServiceability(pincode: string) {
    if (!/^\d{6}$/.test(pincode)) return;
    try {
      const result = await apiFetch<{ serviceable: boolean; etaDays?: number; message?: string }>(
        `/api/stores/serviceability/${pincode}`
      );
      setServiceability({ pincode, ...result });
    } catch {
      setServiceability(null);
    }
  }

  async function handlePincodeChange(pincode: string) {
    setForm((f) => ({ ...f, pincode }));
    if (/^\d{6}$/.test(pincode)) {
      checkServiceability(pincode);
      try {
        const info = await apiFetch<{ city: string; state: string }>(`/api/stores/pincode-info/${pincode}`);
        setForm((f) => ({ ...f, city: info.city, state: info.state }));
      } catch {
        // unknown pincode — let the admin type city/state manually
      }
    }
  }

  async function handleSaveNew(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await apiFetch<{ addresses: SavedAddress[] }>("/api/addresses", { method: "POST", json: form });
      setAddresses(data.addresses);
      const added = data.addresses[data.addresses.length - 1];
      setSelectedId(added._id);
      setShowForm(false);
      setForm(EMPTY_FORM);
      checkServiceability(added.pincode);
    } catch (err) {
      toast({ title: "Couldn't save address", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  const selected = addresses?.find((a) => a._id === selectedId);
  const canContinue = Boolean(selected) && serviceability?.pincode === selected?.pincode;

  return (
    <div className="space-y-5">
      {addresses === null && <p className="text-sm text-foreground/50">Loading addresses…</p>}

      {addresses && addresses.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <button
              key={a._id}
              onClick={() => {
                setSelectedId(a._id);
                checkServiceability(a.pincode);
              }}
              className={cn(
                "rounded-xl border p-4 text-left text-sm transition-colors",
                selectedId === a._id ? "border-accent bg-accent/5" : "border-border hover:border-foreground/30"
              )}
            >
              <p className="font-medium">
                {a.name} <span className="ml-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] uppercase">{a.label}</span>
              </p>
              <p className="mt-1 text-foreground/60">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} — {a.pincode}
              </p>
              <p className="mt-1 text-xs text-foreground/40">{a.phone}</p>
            </button>
          ))}
        </div>
      )}

      {serviceability && selected && serviceability.pincode === selected.pincode && (
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs",
            serviceability.serviceable ? "text-[var(--color-sage-dark)]" : "text-red-600"
          )}
        >
          {serviceability.serviceable ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" /> Deliverable to {serviceability.pincode} — usually in{" "}
              {serviceability.etaDays} days
            </>
          ) : (
            <>
              <XCircle className="h-3.5 w-3.5" /> {serviceability.message ?? "Not serviceable"} — you can still choose
              in-store pickup
            </>
          )}
        </p>
      )}

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-sm text-accent hover:underline">
          <Plus className="h-4 w-4" /> Add a new address
        </button>
      ) : (
        <form onSubmit={handleSaveNew} className="space-y-4 rounded-xl border border-border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input
              label="Phone"
              required
              inputMode="tel"
              placeholder="10-digit mobile number"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: normalizeIndianPhone(e.target.value) }))}
            />
          </div>
          <Input label="Address line 1" required value={form.line1} onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))} />
          <Input label="Address line 2 (optional)" value={form.line2} onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Pincode"
              required
              maxLength={6}
              inputMode="numeric"
              value={form.pincode}
              onChange={(e) => handlePincodeChange(e.target.value)}
            />
            <Input label="City" required value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            <Input label="State" required value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} magnetic={false}>
              {saving ? "Saving…" : "Save address"}
            </Button>
            {addresses && addresses.length > 0 && (
              <Button type="button" size="sm" variant="ghost" magnetic={false} onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}

      <Button
        size="lg"
        disabled={!canContinue}
        onClick={() => selected && onContinue({ addressId: selected._id, pincode: selected.pincode })}
      >
        Continue to delivery
      </Button>
    </div>
  );
}
