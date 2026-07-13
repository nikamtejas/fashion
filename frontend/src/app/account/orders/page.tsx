"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

interface OrderSummary {
  _id: string;
  orderNumber: string;
  status: string;
  deliveryMethod: "HOME" | "PICKUP";
  createdAt: string;
  pricing: { total: number };
  items: { name: string; image?: string; qty: number }[];
  storeLocation?: { name: string; city: string };
}

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = React.useState<OrderSummary[] | null>(null);

  React.useEffect(() => {
    if (!authLoading && !user) router.replace("/login?callbackUrl=/account/orders");
  }, [authLoading, user, router]);

  React.useEffect(() => {
    if (!user) return;
    apiFetch<{ orders: OrderSummary[] }>("/api/orders").then((data) => setOrders(data.orders));
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl">My orders</h1>

      {orders === null && (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {orders?.length === 0 && <p className="mt-8 text-sm text-foreground/50">No orders yet.</p>}

      <div className="mt-8 space-y-4">
        {orders?.map((o) => (
          <Link
            key={o._id}
            href={`/account/orders/${o._id}`}
            className="block rounded-2xl border border-border p-4 transition-colors hover:border-foreground/30"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {o.items.length > 0
                    ? o.items.length === 1
                      ? o.items[0].name
                      : `${o.items[0].name} + ${o.items.length - 1} more`
                    : o.orderNumber}
                </p>
                <p className="mt-0.5 text-xs text-foreground/50">
                  {o.orderNumber} · {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                  {o.deliveryMethod === "PICKUP" ? `Pickup — ${o.storeLocation?.name ?? "store"}` : "Home delivery"}
                </p>
              </div>
              <div className="text-right">
                <Badge variant={o.status === "DELIVERED" ? "success" : "outline"}>{o.status.replaceAll("_", " ")}</Badge>
                <p className="mt-1 text-sm tabular-nums">₹{o.pricing.total.toLocaleString("en-IN")}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {o.items.slice(0, 4).map((i, idx) => (
                <div key={idx} className="relative h-14 w-11 overflow-hidden rounded-md bg-foreground/5">
                  {i.image && <Image src={i.image} alt={i.name} fill className="object-cover" />}
                </div>
              ))}
              {o.items.length > 4 && (
                <span className="self-center text-xs text-foreground/40">+{o.items.length - 4} more</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
