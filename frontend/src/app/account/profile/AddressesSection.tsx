"use client";

import * as React from "react";
import { Plus, Star, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SavedAddress {
  _id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

interface AddressForm {
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

const EMPTY_FORM: AddressForm = { label: "Home", name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "" };

export function AddressesSection() {
  const { toast } = useToast();
  const [addresses, setAddresses] = React.useState<SavedAddress[] | null>(null);
  const [form, setForm] = React.useState<AddressForm>(EMPTY_FORM);
  /** null = list view, "new" = adding, otherwise the _id being edited. */
  const [editing, setEditing] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    apiFetch<{ addresses: SavedAddress[] }>("/api/addresses").then((data) => setAddresses(data.addresses));
  }, []);

  async function handlePincodeChange(pincode: string) {
    setForm((f) => ({ ...f, pincode }));
    if (/^\d{6}$/.test(pincode)) {
      try {
        const info = await apiFetch<{ city: string; state: string }>(`/api/stores/pincode-info/${pincode}`);
        setForm((f) => ({ ...f, city: info.city, state: info.state }));
      } catch {
        // unknown pincode — type city/state manually
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const data =
        editing === "new"
          ? await apiFetch<{ addresses: SavedAddress[] }>("/api/addresses", { method: "POST", json: form })
          : await apiFetch<{ addresses: SavedAddress[] }>(`/api/addresses/${editing}`, { method: "PATCH", json: form });
      setAddresses(data.addresses);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast({ title: editing === "new" ? "Address added" : "Address updated", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't save address", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const data = await apiFetch<{ addresses: SavedAddress[] }>(`/api/addresses/${id}`, { method: "DELETE" });
      setAddresses(data.addresses);
      toast({ title: "Address removed", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't remove address", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }

  async function handleMakeDefault(id: string) {
    try {
      const data = await apiFetch<{ addresses: SavedAddress[] }>(`/api/addresses/${id}`, {
        method: "PATCH",
        json: { isDefault: true },
      });
      setAddresses(data.addresses);
    } catch (err) {
      toast({ title: "Couldn't update address", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }

  if (addresses === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {addresses.length === 0 && !editing && (
        <p className="text-sm text-foreground/50">No saved addresses yet — add one for faster checkout.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {addresses.map((a) => (
          <div
            key={a._id}
            className={cn("rounded-xl border p-4 text-sm", a.isDefault ? "border-accent bg-accent/5" : "border-border")}
          >
            <p className="font-medium">
              {a.name}{" "}
              <span className="ml-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] uppercase">{a.label}</span>
              {a.isDefault && <span className="ml-1 text-[10px] uppercase text-accent">default</span>}
            </p>
            <p className="mt-1 text-foreground/60">
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} — {a.pincode}
            </p>
            <p className="mt-1 text-xs text-foreground/40">{a.phone}</p>
            <div className="mt-3 flex gap-3 text-xs">
              <button
                onClick={() => {
                  setEditing(a._id);
                  setForm({ label: a.label, name: a.name, phone: a.phone, line1: a.line1, line2: a.line2 ?? "", city: a.city, state: a.state, pincode: a.pincode });
                }}
                className="flex items-center gap-1 text-foreground/60 hover:text-foreground"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
              {!a.isDefault && (
                <button onClick={() => handleMakeDefault(a._id)} className="flex items-center gap-1 text-foreground/60 hover:text-foreground">
                  <Star className="h-3 w-3" /> Make default
                </button>
              )}
              <button onClick={() => handleDelete(a._id)} className="flex items-center gap-1 text-red-600 hover:text-red-700">
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {!editing ? (
        <button
          onClick={() => {
            setForm(EMPTY_FORM);
            setEditing("new");
          }}
          className="flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <Plus className="h-4 w-4" /> Add a new address
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border p-4">
          <p className="text-sm font-medium">{editing === "new" ? "New address" : "Edit address"}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Label (Home, Office…)" required value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            <Input label="Full name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone" required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <Input
              label="Pincode"
              required
              maxLength={6}
              inputMode="numeric"
              value={form.pincode}
              onChange={(e) => handlePincodeChange(e.target.value)}
            />
          </div>
          <Input label="Address line 1" required value={form.line1} onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))} />
          <Input label="Address line 2 (optional)" value={form.line2} onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="City" required value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            <Input label="State" required value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy} magnetic={false}>
              {busy ? "Saving…" : "Save address"}
            </Button>
            <Button type="button" size="sm" variant="ghost" magnetic={false} onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
