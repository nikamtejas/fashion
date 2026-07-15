"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { MapPin, LocateFixed, Clock, Phone } from "lucide-react";
import { apiFetch, cachedApiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { NearbyStore } from "@/components/checkout/types";

const StoreMap = dynamic(() => import("@/components/checkout/StoreMap"), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse rounded-2xl bg-foreground/5" />,
});

interface StoreListing {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  phone?: string;
  today: { open: string | null; close: string | null; isOpen: boolean };
  distanceKm?: number;
}

export default function StoreLocatorPage() {
  const { toast } = useToast();
  const [allStores, setAllStores] = React.useState<StoreListing[] | null>(null);
  const [nearby, setNearby] = React.useState<StoreListing[] | null>(null);
  const [pincode, setPincode] = React.useState("");
  const [locating, setLocating] = React.useState(false);
  const [selected, setSelected] = React.useState<string | undefined>();

  React.useEffect(() => {
    // Store locations/hours change rarely — cache briefly (short enough
    // that the today-is-open flag doesn't go stale across an open/close
    // boundary) instead of re-fetching the full list on every visit.
    cachedApiFetch<{ stores: StoreListing[] }>("/api/stores", 120_000)
      .then((d) => setAllStores(d.stores))
      .catch(() => setAllStores([]));
  }, []);

  const findNearby = React.useCallback(
    async (params: string) => {
      setNearby(null);
      try {
        const data = await apiFetch<{ stores: NearbyStore[] }>(`/api/stores/nearby?${params}`);
        setNearby(data.stores);
        if (data.stores[0]) setSelected(data.stores[0].id);
      } catch (err) {
        setNearby([]);
        toast({ title: "Couldn't find stores", description: err instanceof Error ? err.message : undefined, variant: "error" });
      }
    },
    [toast]
  );

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast({ title: "Location unavailable", description: "Your browser doesn't support geolocation.", variant: "error" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        findNearby(`lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
      },
      () => {
        setLocating(false);
        toast({ title: "Couldn't get your location", description: "Enter a pincode instead.", variant: "error" });
      }
    );
  }

  const list = nearby ?? allStores;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-sienna">Store Locator</p>
      <h1 className="font-display mt-2 text-4xl sm:text-5xl">Find a LuxeLoom store</h1>
      <p className="mt-3 max-w-lg text-sm text-foreground/60">
        Try before you buy, or pick up an online order same day at any of our stores.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (/^\d{6}$/.test(pincode)) findNearby(`pincode=${pincode}`);
        }}
        className="mt-8 flex flex-wrap items-end gap-3"
      >
        <Input
          label="Pincode"
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
          maxLength={6}
          inputMode="numeric"
          placeholder="e.g. 400001"
          className="h-11 w-40"
        />
        <Button type="submit" size="sm" magnetic={false}>
          Search
        </Button>
        <Button type="button" size="sm" variant="outline" magnetic={false} disabled={locating} onClick={useMyLocation}>
          <LocateFixed className="h-3.5 w-3.5" /> {locating ? "Locating…" : "Use my location"}
        </Button>
        {nearby && (
          <button
            type="button"
            onClick={() => {
              setNearby(null);
              setPincode("");
            }}
            className="text-xs text-foreground/50 underline underline-offset-2 hover:text-foreground"
          >
            Clear
          </button>
        )}
      </form>

      <Tabs defaultValue="list" className="mt-10">
        <TabsList>
          <TabsTrigger value="list">All stores</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {list === null && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}
          {list?.length === 0 && <p className="mt-6 text-sm text-foreground/50">No stores found — try another pincode.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {list?.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "rounded-2xl border p-5 transition-colors",
                  selected === s.id ? "border-accent bg-accent/5" : "border-border"
                )}
              >
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="mt-1 text-xs text-foreground/60">
                  {s.address}, {s.city}, {s.state} — {s.pincode}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  {s.distanceKm !== undefined && (
                    <span className="flex items-center gap-1 text-foreground/50">
                      <MapPin className="h-3 w-3" /> {s.distanceKm} km away
                    </span>
                  )}
                  <span className={cn("flex items-center gap-1", s.today.isOpen ? "text-[var(--color-sage-dark)]" : "text-red-600")}>
                    <Clock className="h-3 w-3" />
                    {s.today.open ? `${s.today.isOpen ? "Open" : "Closed"} · ${s.today.open}–${s.today.close}` : "Closed today"}
                  </span>
                  {s.phone && (
                    <a href={`tel:${s.phone}`} className="flex items-center gap-1 text-foreground/50 hover:text-foreground">
                      <Phone className="h-3 w-3" /> {s.phone}
                    </a>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-accent underline underline-offset-2"
                  >
                    Get directions
                  </a>
                  <button onClick={() => setSelected(s.id)} className="text-xs text-foreground/50 underline underline-offset-2 hover:text-foreground">
                    Show on map
                  </button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="map">
          <StoreMap
            stores={(list ?? []).map((s) => ({ id: s.id, name: s.name, address: s.address, city: s.city, lat: s.lat, lng: s.lng }))}
            selectedId={selected}
            onSelect={setSelected}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
