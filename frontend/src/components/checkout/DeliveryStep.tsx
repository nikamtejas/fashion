"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Truck, Store as StoreIcon, MapPin, LocateFixed, CheckCircle2, Clock } from "lucide-react";
import { apiFetch, cachedApiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { SlotCalendar } from "./SlotCalendar";
import type { NearbyStore } from "./types";

const StoreMap = dynamic(() => import("./StoreMap"), { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-2xl bg-foreground/5" /> });

export function DeliveryStep({
  defaultPincode,
  homeEtaDays,
  homeServiceable,
  onContinue,
  onBack,
}: {
  defaultPincode: string;
  homeEtaDays?: number;
  homeServiceable: boolean;
  onContinue: (sel: { deliveryMethod: "HOME" } | { deliveryMethod: "PICKUP"; storeId: string; storeName: string; appointment: { date: string; timeSlot: string } }) => void;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [method, setMethod] = React.useState<"HOME" | "PICKUP">(homeServiceable ? "HOME" : "PICKUP");
  const [pincode, setPincode] = React.useState(defaultPincode);
  const [stores, setStores] = React.useState<NearbyStore[] | null>(null);
  const [allStores, setAllStores] = React.useState<NearbyStore[]>([]);
  const [selectedStore, setSelectedStore] = React.useState<string | null>(null);
  const [appointment, setAppointment] = React.useState<{ date: string; timeSlot: string } | undefined>();
  const [locating, setLocating] = React.useState(false);

  const findStores = React.useCallback(
    async (params: string) => {
      setStores(null);
      setSelectedStore(null);
      setAppointment(undefined);
      try {
        const data = await apiFetch<{ stores: NearbyStore[] }>(`/api/stores/nearby?${params}`);
        setStores(data.stores);
      } catch (err) {
        setStores([]);
        toast({ title: "Couldn't find stores", description: err instanceof Error ? err.message : undefined, variant: "error" });
      }
    },
    [toast]
  );

  React.useEffect(() => {
    // First switch to the pickup tab kicks off the initial store search
    // from the checkout pincode — a data-fetching effect; setState happens
    // in async callbacks.
    if (method === "PICKUP" && stores === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (/^\d{6}$/.test(pincode)) findStores(`pincode=${pincode}`);
      cachedApiFetch<{ stores: NearbyStore[] }>(`/api/stores`, 120_000).then((d) => setAllStores(d.stores as NearbyStore[]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

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

  const selected = stores?.find((s) => s.id === selectedStore);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => setMethod("HOME")}
          disabled={!homeServiceable}
          className={cn(
            "rounded-xl border p-4 text-left transition-colors",
            method === "HOME" ? "border-accent bg-accent/5" : "border-border",
            !homeServiceable && "cursor-not-allowed opacity-50"
          )}
        >
          <p className="flex items-center gap-2 text-sm font-medium">
            <Truck className="h-4 w-4" /> Home delivery
          </p>
          <p className="mt-1 text-xs text-foreground/60">
            {homeServiceable ? `Blue Dart courier — usually ${homeEtaDays ?? 3}–${(homeEtaDays ?? 3) + 2} days` : "Not available for your pincode"}
          </p>
        </button>
        <button
          onClick={() => setMethod("PICKUP")}
          className={cn(
            "rounded-xl border p-4 text-left transition-colors",
            method === "PICKUP" ? "border-accent bg-accent/5" : "border-border"
          )}
        >
          <p className="flex items-center gap-2 text-sm font-medium">
            <StoreIcon className="h-4 w-4" /> In-store pickup
          </p>
          <p className="mt-1 text-xs text-foreground/60">Free — collect at a LuxeLoom store near you</p>
        </button>
      </div>

      {method === "PICKUP" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              maxLength={6}
              inputMode="numeric"
              placeholder="Pincode"
              className="h-10 w-32 rounded-lg border border-border bg-surface px-3 text-sm"
            />
            <Button size="sm" magnetic={false} onClick={() => /^\d{6}$/.test(pincode) && findStores(`pincode=${pincode}`)}>
              Find stores
            </Button>
            <Button size="sm" variant="outline" magnetic={false} disabled={locating} onClick={useMyLocation}>
              <LocateFixed className="h-3.5 w-3.5" /> {locating ? "Locating…" : "Use my location"}
            </Button>
          </div>

          <Tabs defaultValue="list">
            <TabsList>
              <TabsTrigger value="list">Nearest stores</TabsTrigger>
              <TabsTrigger value="map">Map</TabsTrigger>
            </TabsList>

            <TabsContent value="list">
              {stores === null && <p className="text-sm text-foreground/50">Finding your nearest stores…</p>}
              {stores?.length === 0 && <p className="text-sm text-foreground/50">No stores found — try another pincode.</p>}
              <div className="space-y-3">
                {stores?.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedStore(s.id);
                      setAppointment(undefined);
                    }}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-colors",
                      selectedStore === s.id ? "border-accent bg-accent/5" : "border-border hover:border-foreground/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="mt-0.5 text-xs text-foreground/60">
                          {s.address}, {s.city} — {s.pincode}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                          <span className="flex items-center gap-1 text-foreground/50">
                            <MapPin className="h-3 w-3" /> {s.distanceKm} km
                          </span>
                          <span className={cn("flex items-center gap-1", s.today.isOpen ? "text-[var(--color-sage-dark)]" : "text-red-600")}>
                            <Clock className="h-3 w-3" />
                            {s.today.open ? `${s.today.isOpen ? "Open" : "Closed"} · ${s.today.open}–${s.today.close}` : "Closed today"}
                          </span>
                        </div>
                        {s.stock.status !== "UNKNOWN" && (
                          <p
                            className={cn(
                              "mt-1.5 flex items-center gap-1 text-xs",
                              s.stock.status === "ALL_IN_STOCK" ? "text-[var(--color-sage-dark)]" : "text-amber-600"
                            )}
                          >
                            <CheckCircle2 className="h-3 w-3" /> {s.stock.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="map">
              <StoreMap
                stores={(allStores.length > 0 ? allStores : (stores ?? [])).map((s) => ({
                  id: s.id,
                  name: s.name,
                  address: s.address,
                  city: s.city,
                  lat: s.lat,
                  lng: s.lng,
                }))}
                selectedId={selectedStore ?? undefined}
                onSelect={(id) => setSelectedStore(id)}
              />
            </TabsContent>
          </Tabs>

          {selected && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-medium">Pick a time at {selected.name}</p>
              <p className="mb-3 mt-0.5 text-xs text-foreground/50">
                {selected.stock.status === "TRANSFER_NEEDED"
                  ? "Includes +1 day for the item transfer — earliest slots reflect this."
                  : "Slots for the next 7 days."}
              </p>
              <SlotCalendar storeId={selected.id} value={appointment} onChange={setAppointment} />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" magnetic={false} onClick={onBack}>
          Back
        </Button>
        <Button
          size="lg"
          disabled={method === "PICKUP" && (!selected || !appointment)}
          onClick={() => {
            if (method === "HOME") {
              onContinue({ deliveryMethod: "HOME" });
            } else if (selected && appointment) {
              onContinue({ deliveryMethod: "PICKUP", storeId: selected.id, storeName: selected.name, appointment });
            }
          }}
        >
          Continue to payment
        </Button>
      </div>
    </div>
  );
}
