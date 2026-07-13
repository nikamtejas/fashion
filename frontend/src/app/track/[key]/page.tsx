"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { RefreshCw, PackageCheck, MapPin } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

const TrackMap = dynamic(() => import("@/components/track/TrackMap"), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-2xl bg-foreground/5" />,
});

interface TrackEvent {
  status: string;
  location?: string;
  description?: string;
  timestamp: string;
}

interface TrackData {
  kind: "HOME" | "PICKUP";
  orderNumber: string;
  status: string;
  items?: { name: string; qty: number; image?: string }[];
  awbNumber?: string | null;
  courier?: string;
  events?: TrackEvent[];
  route?: { lat: number; lng: number; label?: string; timestamp?: string }[];
  current?: { lat: number; lng: number; label?: string; scannedAt?: string; honest?: string } | null;
  eta?: string | null;
  proofOfDeliveryUrl?: string | null;
  timeline?: { label: string; done: boolean; current: boolean }[];
  store?: { name: string; city: string; lat: number; lng: number } | null;
  appointment?: { date: string; timeSlot: string; status: string } | null;
}

const REFRESH_MS = 30_000;

export default function TrackPage() {
  const { key } = useParams<{ key: string }>();
  const [data, setData] = React.useState<TrackData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastFetched, setLastFetched] = React.useState<Date | null>(null);

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await apiFetch<TrackData>(`/api/track/${key}`);
      setData(result);
      setError(null);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load tracking");
    } finally {
      setRefreshing(false);
    }
  }, [key]);

  React.useEffect(() => {
    // Initial fetch + auto-refresh; setState happens in the async callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="font-display text-2xl">Nothing found</p>
        <p className="mt-2 text-sm text-foreground/60">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-12">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const delivered = data.status === "DELIVERED";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">
            {data.items && data.items.length > 0
              ? data.items.length === 1
                ? data.items[0].name
                : `${data.items[0].name} + ${data.items.length - 1} more`
              : `Tracking ${data.orderNumber}`}
          </h1>
          <p className="mt-1 text-xs text-foreground/50">
            Order {data.orderNumber} ·{" "}
            {data.kind === "HOME" && data.awbNumber ? `${data.courier} · AWB ${data.awbNumber}` : "In-store pickup"}
            {lastFetched && ` · updated ${lastFetched.toLocaleTimeString("en-IN")}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={delivered ? "success" : "accent"}>{data.status.replaceAll("_", " ")}</Badge>
          <button
            onClick={load}
            aria-label="Refresh"
            className="rounded-full border border-border p-2 text-foreground/60 hover:text-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {data.eta && !delivered && (
        <p className="mt-3 text-sm text-foreground/60">
          Estimated delivery{" "}
          <span className="font-medium text-foreground">
            {new Date(data.eta).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
          </span>
        </p>
      )}

      {data.kind === "HOME" && (data.route?.length || data.current) ? (
        <div className="mt-6">
          <TrackMap route={data.route ?? []} current={data.current ?? null} />
          {data.current?.honest && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-foreground/50">
              <MapPin className="h-3.5 w-3.5" /> {data.current.honest} — couriers report checkpoint scans, not live
              GPS.
            </p>
          )}
        </div>
      ) : null}

      {data.kind === "PICKUP" && data.timeline && (
        <ol className="mt-8 space-y-0">
          {data.timeline.map((step, i) => (
            <TimelineRow
              key={step.label}
              title={step.label}
              done={step.done}
              current={step.current}
              last={i === data.timeline!.length - 1}
              delay={i * 0.08}
            />
          ))}
        </ol>
      )}

      {data.kind === "HOME" && data.events && (
        <ol className="mt-8">
          {[...data.events].reverse().map((e, i, arr) => (
            <TimelineRow
              key={`${e.status}-${e.timestamp}`}
              title={e.description ?? e.status.replaceAll("_", " ")}
              subtitle={`${e.location ? `${e.location} · ` : ""}${new Date(e.timestamp).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
              done
              current={i === 0 && !delivered}
              last={i === arr.length - 1}
              delay={i * 0.06}
            />
          ))}
        </ol>
      )}

      {delivered && data.proofOfDeliveryUrl && (
        <div className="mt-8 rounded-2xl border border-sage/40 bg-sage/10 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-sage-dark)]">
            <PackageCheck className="h-4 w-4" /> Delivered — proof of delivery
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.proofOfDeliveryUrl} alt="Proof of delivery" className="mt-3 max-h-48 rounded-xl object-cover" />
        </div>
      )}

      {data.appointment && (
        <p className="mt-6 text-sm text-foreground/60">
          {data.store?.name} ·{" "}
          {new Date(data.appointment.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })},{" "}
          {data.appointment.timeSlot}
        </p>
      )}
    </div>
  );
}

function TimelineRow({
  title,
  subtitle,
  done,
  current,
  last,
  delay,
}: {
  title: string;
  subtitle?: string;
  done: boolean;
  current: boolean;
  last: boolean;
  delay: number;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="relative flex gap-4 pb-8 last:pb-0"
    >
      {!last && <span className="absolute left-[7px] top-5 h-full w-0.5 bg-border" aria-hidden />}
      <span
        className={`relative mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${
          current
            ? "border-sienna bg-sienna shadow-[0_0_0_4px_rgba(193,91,60,0.2)]"
            : done
              ? "border-sage bg-sage"
              : "border-border bg-surface"
        }`}
      />
      <div>
        <p className={`text-sm ${current ? "font-semibold" : done ? "" : "text-foreground/40"}`}>{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-foreground/50">{subtitle}</p>}
      </div>
    </motion.li>
  );
}
