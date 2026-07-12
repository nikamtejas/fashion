"use client";

import * as React from "react";
import { BellRing, TrendingDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

export function AlertButtons({ productId, inStock }: { productId: string; inStock: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [armed, setArmed] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!user) return;
    apiFetch<{ types: string[] }>(`/api/alerts/product/${productId}`)
      .then((d) => setArmed(new Set(d.types)))
      .catch(() => {});
  }, [user, productId]);

  if (!user) return null;

  async function toggle(type: "PRICE_DROP" | "BACK_IN_STOCK") {
    const isArmed = armed.has(type);
    try {
      if (isArmed) {
        await apiFetch(`/api/alerts/${productId}/${type}`, { method: "DELETE" });
        setArmed((prev) => {
          const next = new Set(prev);
          next.delete(type);
          return next;
        });
      } else {
        await apiFetch("/api/alerts", { method: "POST", json: { productId, type } });
        setArmed((prev) => new Set(prev).add(type));
        toast({
          title: type === "PRICE_DROP" ? "Price-drop alert set" : "We'll tell you when it's back",
          description: "You'll get an email and an in-app notification.",
          variant: "success",
        });
      }
    } catch (err) {
      toast({ title: "Couldn't update alert", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={() => toggle("PRICE_DROP")}
        className={cn(
          "flex items-center gap-1.5 text-xs",
          armed.has("PRICE_DROP") ? "font-medium text-sienna" : "text-foreground/60 hover:text-foreground"
        )}
      >
        <TrendingDown className="h-3.5 w-3.5" />
        {armed.has("PRICE_DROP") ? "Price-drop alert on" : "Alert me on price drop"}
      </button>
      {!inStock && (
        <button
          onClick={() => toggle("BACK_IN_STOCK")}
          className={cn(
            "flex items-center gap-1.5 text-xs",
            armed.has("BACK_IN_STOCK") ? "font-medium text-sienna" : "text-foreground/60 hover:text-foreground"
          )}
        >
          <BellRing className="h-3.5 w-3.5" />
          {armed.has("BACK_IN_STOCK") ? "Back-in-stock alert on" : "Notify me when back"}
        </button>
      )}
    </div>
  );
}
