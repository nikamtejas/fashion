"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface AdminStore {
  _id: string;
  name: string;
  city: string;
  lat?: number;
  lng?: number;
  pickupConfig?: {
    windows: { start: string; end: string }[];
    capacityPerSlot: number;
    sameDayReadyHours: number;
  };
}

const EMPTY_STORE = { name: "", address: "", city: "", state: "", pincode: "", phone: "", lat: "", lng: "" };

const DEFAULT_CONFIG = {
  windows: [
    { start: "10:00", end: "12:00" },
    { start: "12:00", end: "14:00" },
    { start: "14:00", end: "16:00" },
    { start: "16:00", end: "18:00" },
    { start: "18:00", end: "20:00" },
  ],
  capacityPerSlot: 4,
  sameDayReadyHours: 3,
};

export default function AdminStoresPage() {
  const { toast } = useToast();
  const [stores, setStores] = React.useState<AdminStore[] | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(EMPTY_STORE);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    apiFetch<{ stores: AdminStore[] }>("/api/admin/stores")
      .then((data) => setStores(data.stores))
      .catch((err) => {
        setStores([]);
        toast({ title: "Couldn't load stores", description: err instanceof Error ? err.message : undefined, variant: "error" });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createStore() {
    setCreating(true);
    try {
      const data = await apiFetch<{ store: AdminStore }>("/api/admin/stores", {
        method: "POST",
        json: {
          name: form.name.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
          phone: form.phone.trim() || undefined,
          lat: form.lat.trim() ? Number(form.lat) : undefined,
          lng: form.lng.trim() ? Number(form.lng) : undefined,
        },
      });
      setStores((prev) => [...(prev ?? []), data.store]);
      setForm(EMPTY_STORE);
      toast({
        title: `${data.store.name} added`,
        description: `Located at ${data.store.lat?.toFixed(4)}, ${data.store.lng?.toFixed(4)} — it now appears in nearest-store search.`,
        variant: "success",
      });
    } catch (err) {
      toast({ title: "Couldn't add store", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setCreating(false);
    }
  }

  const canCreate =
    form.name.trim().length >= 2 &&
    form.address.trim().length >= 3 &&
    form.city.trim().length >= 2 &&
    form.state.trim().length >= 2 &&
    /^\d{6}$/.test(form.pincode.trim());

  function update(storeId: string, patch: (c: NonNullable<AdminStore["pickupConfig"]>) => NonNullable<AdminStore["pickupConfig"]>) {
    setStores(
      (prev) =>
        prev?.map((s) => (s._id === storeId ? { ...s, pickupConfig: patch(s.pickupConfig ?? DEFAULT_CONFIG) } : s)) ?? null
    );
  }

  async function save(store: AdminStore) {
    setSaving(store._id);
    try {
      await apiFetch(`/api/admin/stores/${store._id}/pickup-config`, {
        method: "PATCH",
        json: store.pickupConfig ?? DEFAULT_CONFIG,
      });
      toast({ title: `${store.name} slot config saved`, variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't save", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl">Stores</h1>

      <div className="mt-6 rounded-2xl border border-border p-5">
        <p className="text-sm font-medium">Add a store</p>
        <p className="mt-0.5 text-xs text-foreground/50">
          Leave latitude/longitude blank to locate it automatically from the pincode.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StoreField label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="LuxeLoom Pune" />
          <StoreField label="Address" value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} placeholder="12 MG Road" />
          <StoreField label="City" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} placeholder="Pune" />
          <StoreField label="State" value={form.state} onChange={(v) => setForm((f) => ({ ...f, state: v }))} placeholder="Maharashtra" />
          <StoreField label="Pincode" value={form.pincode} onChange={(v) => setForm((f) => ({ ...f, pincode: v }))} placeholder="411001" maxLength={6} />
          <StoreField label="Phone (optional)" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="+91 …" />
          <StoreField label="Latitude (optional)" value={form.lat} onChange={(v) => setForm((f) => ({ ...f, lat: v }))} placeholder="18.5204" />
          <StoreField label="Longitude (optional)" value={form.lng} onChange={(v) => setForm((f) => ({ ...f, lng: v }))} placeholder="73.8567" />
        </div>
        <Button size="sm" className="mt-4" magnetic={false} disabled={!canCreate || creating} onClick={createStore}>
          <Plus className="h-3.5 w-3.5" /> {creating ? "Adding…" : "Add store"}
        </Button>
      </div>

      <h2 className="mt-10 font-display text-xl">Pickup slots</h2>
      {stores === null && <p className="mt-8 text-sm text-foreground/50">Loading stores…</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {stores?.map((store) => {
          const config = store.pickupConfig ?? DEFAULT_CONFIG;
          return (
            <div key={store._id} className="rounded-2xl border border-border p-5">
              <p className="text-sm font-medium">{store.name}</p>
              <p className="text-xs text-foreground/50">{store.city}</p>

              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-foreground/50">Time windows</p>
              <div className="mt-2 space-y-2">
                {config.windows.map((w, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={w.start}
                      onChange={(e) =>
                        update(store._id, (c) => ({
                          ...c,
                          windows: c.windows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)),
                        }))
                      }
                      className="h-8 rounded-lg border border-border bg-surface px-2 text-xs"
                    />
                    <span className="text-xs text-foreground/40">–</span>
                    <input
                      type="time"
                      value={w.end}
                      onChange={(e) =>
                        update(store._id, (c) => ({
                          ...c,
                          windows: c.windows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)),
                        }))
                      }
                      className="h-8 rounded-lg border border-border bg-surface px-2 text-xs"
                    />
                    <button
                      onClick={() => update(store._id, (c) => ({ ...c, windows: c.windows.filter((_, j) => j !== i) }))}
                      className="p-1 text-foreground/40 hover:text-red-600"
                      aria-label="Remove window"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    update(store._id, (c) => ({ ...c, windows: [...c.windows, { start: "18:00", end: "20:00" }] }))
                  }
                  className="flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  <Plus className="h-3 w-3" /> Add window
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wider text-foreground/50">Capacity / slot</label>
                  <input
                    type="number"
                    min={1}
                    value={config.capacityPerSlot}
                    onChange={(e) => update(store._id, (c) => ({ ...c, capacityPerSlot: Number(e.target.value) || 1 }))}
                    className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wider text-foreground/50">Same-day ready (hrs)</label>
                  <input
                    type="number"
                    min={0}
                    value={config.sameDayReadyHours}
                    onChange={(e) => update(store._id, (c) => ({ ...c, sameDayReadyHours: Number(e.target.value) || 0 }))}
                    className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm"
                  />
                </div>
              </div>

              <Button size="sm" className="mt-4 w-full" magnetic={false} disabled={saving === store._id} onClick={() => save(store)}>
                {saving === store._id ? "Saving…" : "Save"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StoreField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="text-[10px] font-medium uppercase tracking-wider text-foreground/50">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm"
      />
    </div>
  );
}
