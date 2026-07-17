"use client";

import * as React from "react";
import { Truck, Store as StoreIcon, MapPin, Clock, LocateFixed } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { SlotCalendar } from "@/components/checkout/SlotCalendar";
import { fileToDataUri, compressImageForUpload } from "@/lib/imageQuality";
import { cn } from "@/lib/utils";
import type { NearbyStore } from "@/components/checkout/types";

interface OrderItem {
  sku: string;
  name: string;
  size?: string;
  color?: string;
  price: number;
  qty: number;
  image?: string;
}

export function ReturnRequestModal({
  open,
  onOpenChange,
  orderId,
  items,
  defaultPincode,
  paymentMethod,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  items: OrderItem[];
  defaultPincode?: string;
  paymentMethod?: string;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [qtyBySku, setQtyBySku] = React.useState<Record<string, number>>({});
  const [reason, setReason] = React.useState("");
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [method, setMethod] = React.useState<"COURIER" | "STORE">("COURIER");
  const [pincode, setPincode] = React.useState(defaultPincode ?? "");
  const [stores, setStores] = React.useState<NearbyStore[] | null>(null);
  const [storeId, setStoreId] = React.useState<string | null>(null);
  const [slot, setSlot] = React.useState<{ date: string; timeSlot: string } | undefined>();
  const [bank, setBank] = React.useState({ accountName: "", accountNumber: "", ifsc: "" });
  const [busy, setBusy] = React.useState(false);
  const [locating, setLocating] = React.useState(false);

  const selectedItems = Object.entries(qtyBySku)
    .filter(([, qty]) => qty > 0)
    .map(([sku, qty]) => ({ sku, qty }));
  const isCod = paymentMethod === "COD";

  async function findStores(params?: string) {
    if (!params) {
      if (!/^\d{6}$/.test(pincode)) return;
      params = `pincode=${pincode}`;
    }
    setStores(null);
    setStoreId(null);
    try {
      const data = await apiFetch<{ stores: NearbyStore[] }>(`/api/stores/nearby?${params}`);
      setStores(data.stores);
    } catch {
      setStores([]);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast({ title: "Location unavailable", description: "Your browser doesn't support geolocation.", variant: "error" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        findStores(`lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
      },
      () => {
        setLocating(false);
        toast({ title: "Couldn't get your location", description: "Enter a pincode instead.", variant: "error" });
      }
    );
  }

  React.useEffect(() => {
    if (method === "STORE" && stores === null && /^\d{6}$/.test(pincode)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      findStores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  async function handlePhotos(files: FileList | null) {
    if (!files) return;
    const uris: string[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      uris.push(await compressImageForUpload(await fileToDataUri(file)));
    }
    setPhotos(uris);
  }

  async function submit() {
    setBusy(true);
    try {
      await apiFetch("/api/returns", {
        method: "POST",
        json: {
          orderId,
          items: selectedItems,
          reason,
          photoDataUris: photos,
          method,
          storeId: method === "STORE" ? storeId : undefined,
          appointment: method === "STORE" ? slot : undefined,
          bankDetails: isCod ? bank : undefined,
        },
      });
      toast({
        title: "Return requested",
        description: method === "STORE" ? "Your drop-off slot is booked — refund in minutes at the store." : "We'll schedule a reverse pickup once approved.",
        variant: "success",
      });
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast({ title: "Couldn't request return", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    selectedItems.length > 0 &&
    reason.trim().length >= 3 &&
    (method === "COURIER" || (storeId && slot)) &&
    (!isCod || (bank.accountName && bank.accountNumber && bank.ifsc));

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Return / refund" className="max-w-2xl">
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">What are you returning?</p>
          <div className="mt-2 space-y-2">
            {items.map((item) => (
              <div key={item.sku} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{item.name}</p>
                  <p className="text-xs text-foreground/50">
                    {item.size} · {item.color} · bought {item.qty}
                  </p>
                </div>
                <select
                  value={qtyBySku[item.sku] ?? 0}
                  onChange={(e) => setQtyBySku((s) => ({ ...s, [item.sku]: Number(e.target.value) }))}
                  className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
                >
                  {Array.from({ length: item.qty + 1 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? "Keep" : `Return ${i}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-foreground/50">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Size runs small"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-foreground/50">
            Photos (optional, up to 4)
          </label>
          <input type="file" accept="image/*" multiple onChange={(e) => handlePhotos(e.target.files)} className="mt-1 block text-xs" />
          {photos.length > 0 && (
            <div className="mt-2 flex gap-2">
              {photos.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={p} alt="" className="h-14 w-14 rounded-lg object-cover" />
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">How do you want to return it?</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setMethod("COURIER")}
              className={cn("rounded-xl border p-3 text-left", method === "COURIER" ? "border-accent bg-accent/5" : "border-border")}
            >
              <p className="flex items-center gap-2 text-sm font-medium">
                <Truck className="h-4 w-4" /> Courier pickup
              </p>
              <p className="mt-1 text-xs text-foreground/60">We collect from your door · refund after it reaches us</p>
            </button>
            <button
              onClick={() => setMethod("STORE")}
              className={cn("rounded-xl border p-3 text-left", method === "STORE" ? "border-accent bg-accent/5" : "border-border")}
            >
              <p className="flex items-center gap-2 text-sm font-medium">
                <StoreIcon className="h-4 w-4" /> Store drop-off
              </p>
              <p className="mt-1 text-xs font-medium text-sienna">Refund in minutes at a store near you</p>
            </button>
          </div>
        </div>

        {method === "STORE" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                maxLength={6}
                inputMode="numeric"
                placeholder="Pincode"
                className="h-10 w-32 rounded-lg border border-border bg-surface px-3 text-sm"
              />
              <Button size="sm" magnetic={false} onClick={() => findStores()}>
                Find stores
              </Button>
              <Button size="sm" variant="outline" magnetic={false} disabled={locating} onClick={useMyLocation}>
                <LocateFixed className="h-3.5 w-3.5" /> {locating ? "Locating…" : "Use my location"}
              </Button>
            </div>
            {stores?.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setStoreId(s.id);
                  setSlot(undefined);
                }}
                className={cn("w-full rounded-xl border p-3 text-left", storeId === s.id ? "border-accent bg-accent/5" : "border-border")}
              >
                <p className="text-sm font-medium">{s.name}</p>
                <p className="mt-0.5 text-xs text-foreground/60">
                  {s.address}, {s.city} — {s.pincode}
                </p>
                <p className="mt-0.5 flex items-center gap-3 text-xs text-foreground/50">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {s.distanceKm} km away
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {s.today.isOpen ? "Open now" : "Closed"}
                  </span>
                </p>
              </button>
            ))}
            {storeId && (
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="mb-2 text-xs text-foreground/50">Pick a drop-off slot</p>
                <SlotCalendar storeId={storeId} value={slot} onChange={setSlot} />
              </div>
            )}
          </div>
        )}

        {isCod && (
          <div className="space-y-3 rounded-xl border border-border bg-surface p-3">
            <p className="text-xs text-foreground/60">You paid by COD — refunds go to your bank account.</p>
            <Input label="Account holder name" value={bank.accountName} onChange={(e) => setBank((b) => ({ ...b, accountName: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Account number" value={bank.accountNumber} onChange={(e) => setBank((b) => ({ ...b, accountNumber: e.target.value }))} />
              <Input label="IFSC" value={bank.ifsc} onChange={(e) => setBank((b) => ({ ...b, ifsc: e.target.value.toUpperCase() }))} />
            </div>
          </div>
        )}

        <Button className="w-full" size="lg" disabled={!canSubmit || busy} onClick={submit}>
          {busy ? "Submitting…" : "Request return"}
        </Button>
      </div>
    </Modal>
  );
}
