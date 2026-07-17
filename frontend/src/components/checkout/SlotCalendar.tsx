"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { SlotDay } from "./types";

function dayLabel(dateStr: string, index: number) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function SlotCalendar({
  storeId,
  value,
  onChange,
}: {
  storeId: string;
  value?: { date: string; timeSlot: string };
  onChange: (v: { date: string; timeSlot: string }) => void;
}) {
  const [days, setDays] = React.useState<SlotDay[] | null>(null);
  const [activeDate, setActiveDate] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  const { toast } = useToast();

  React.useEffect(() => {
    // Refetch slots when the store changes — the reset to the loading state
    // must be synchronous so stale slots never show for the new store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDays(null);
    setError(false);
    apiFetch<{ days: SlotDay[] }>(`/api/stores/${storeId}/slots`)
      .then((data) => {
        setDays(data.days);
        const firstWithSlot = data.days.find((d) => d.slots.some((s) => s.available));
        setActiveDate(firstWithSlot?.date ?? data.days[0]?.date ?? null);
      })
      .catch((err) => {
        setError(true);
        toast({ title: "Couldn't load pickup slots", description: err instanceof Error ? err.message : undefined, variant: "error" });
      });
  }, [storeId, retryCount, toast]);

  if (error) {
    return (
      <div className="text-sm text-foreground/50">
        Couldn&apos;t load pickup slots.{" "}
        <button type="button" onClick={() => setRetryCount((n) => n + 1)} className="text-accent underline underline-offset-2">
          Try again
        </button>
      </div>
    );
  }

  if (days === null) return <p className="text-sm text-foreground/50">Loading slots…</p>;

  const activeDay = days.find((d) => d.date === activeDate);

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((d, i) => {
          const hasSlots = d.slots.some((s) => s.available);
          return (
            <button
              key={d.date}
              onClick={() => setActiveDate(d.date)}
              disabled={!hasSlots}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-xs",
                activeDate === d.date ? "border-ink bg-ink text-ivory dark:border-ivory dark:bg-ivory dark:text-ink" : "border-border",
                !hasSlots && "opacity-40"
              )}
            >
              {dayLabel(d.date, i)}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {activeDay?.slots.map((s) => {
          const isSelected = value?.date === activeDay.date && value?.timeSlot === s.label;
          return (
            <button
              key={s.label}
              disabled={!s.available}
              onClick={() => onChange({ date: activeDay.date, timeSlot: s.label })}
              className={cn(
                "rounded-xl border p-3 text-left text-xs transition-colors",
                isSelected ? "border-accent bg-accent/10" : "border-border",
                !s.available && "cursor-not-allowed opacity-40"
              )}
            >
              <p className="font-medium tabular-nums">{s.label}</p>
              <p className="mt-0.5 text-foreground/50">
                {s.remaining === 0 ? "Full" : s.sameDayReady ? s.sameDayReady : `${s.remaining} slots left`}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
