"use client";

import * as React from "react";
import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ReturnCard, type ReturnView } from "@/components/returns/ReturnCard";

const STEPS = [
  {
    title: "Request a return",
    body: "Open the order from My Orders and pick the items you want to return, once it's marked Delivered.",
  },
  {
    title: "Choose how to send it back",
    body: "A free reverse courier pickup, or drop it at your nearest LuxeLoom store — whichever is easier.",
  },
  {
    title: "Get refunded",
    body: "Once we've received and checked the item, your refund is issued to the original payment method.",
  },
];

export default function ReturnsPage() {
  const { user, loading } = useAuth();
  const [returns, setReturns] = React.useState<ReturnView[] | null>(null);

  React.useEffect(() => {
    if (loading || !user) return;
    apiFetch<{ returns: ReturnView[] }>("/api/returns")
      .then((d) => setReturns(d.returns))
      .catch(() => setReturns([]));
  }, [loading, user]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-sienna">Help</p>
      <h1 className="font-display mt-2 text-4xl sm:text-5xl">Returns & refunds</h1>
      <p className="mt-3 max-w-xl text-sm text-foreground/60">
        We accept returns within <strong className="text-foreground">14 days of delivery</strong>,
        on unworn items with tags attached. Refunds go back to your original payment method once
        we&rsquo;ve received and checked the item.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="rounded-2xl border border-border p-5">
            <p className="font-display text-2xl text-sienna">{i + 1}</p>
            <h2 className="mt-2 text-sm font-semibold">{s.title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-foreground/60">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Your returns</h2>
        <Button asChild size="sm" variant="outline" magnetic={false}>
          <Link href="/account/orders">Start a return</Link>
        </Button>
      </div>

      {loading ? (
        <Skeleton className="mt-6 h-24 w-full" />
      ) : !user ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
          <PackageSearch className="h-6 w-6 text-foreground/30" />
          <p className="text-sm text-foreground/50">Sign in to see your return requests.</p>
          <Button asChild size="sm" magnetic={false}>
            <Link href={`/login?callbackUrl=${encodeURIComponent("/returns")}`}>Sign in</Link>
          </Button>
        </div>
      ) : returns === null ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : returns.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
          <PackageSearch className="h-6 w-6 text-foreground/30" />
          <p className="text-sm text-foreground/50">No returns yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {returns.map((r) => (
            <ReturnCard key={r.id} refund={r} />
          ))}
        </div>
      )}
    </div>
  );
}
