"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, BadgeCheck, Star } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface ModerationReview {
  _id: string;
  rating: number;
  title?: string;
  body?: string;
  photos: { secureUrl: string }[];
  verifiedPurchase: boolean;
  status: string;
  createdAt: string;
  user?: { email: string; name?: string };
  product?: { name: string; slug: string };
}

const TABS = ["PENDING", "APPROVED", "REJECTED"] as const;

export default function AdminReviewsPage() {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<(typeof TABS)[number]>("PENDING");
  const [reviews, setReviews] = React.useState<ModerationReview[] | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    setReviews(null);
    apiFetch<{ reviews: ModerationReview[] }>(`/api/admin/reviews?status=${tab}`).then((d) => setReviews(d.reviews));
  }, [tab]);

  React.useEffect(() => {
    // Refetch on tab change; setState in the async callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/reviews/${id}/${action}`, { method: "POST" });
      toast({ title: action === "approve" ? "Review published" : "Review rejected", variant: "success" });
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Review moderation</h1>
        <div className="inline-flex rounded-full border border-border p-0.5">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium",
                tab === t ? "bg-ink text-ivory dark:bg-ivory dark:text-ink" : "text-foreground/60"
              )}
            >
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {reviews === null && <p className="mt-8 text-sm text-foreground/50">Loading…</p>}
      {reviews?.length === 0 && <p className="mt-8 text-sm text-foreground/50">Nothing here.</p>}

      <div className="mt-6 space-y-3">
        {reviews?.map((r) => (
          <div key={r._id} className="rounded-2xl border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm">
                  <span className="flex items-center gap-0.5 text-sienna">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-sienna" />
                    ))}
                  </span>
                  {r.verifiedPurchase && (
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-sage-dark)]">
                      <BadgeCheck className="h-3 w-3" /> Verified purchase
                    </span>
                  )}
                </p>
                {r.title && <p className="mt-1 text-sm font-medium">{r.title}</p>}
                <p className="mt-1 text-sm text-foreground/70">{r.body}</p>
                {r.photos.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {r.photos.map((p, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={p.secureUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-foreground/40">
                  {r.user?.email} on{" "}
                  <Link href={`/products/${r.product?.slug}`} className="underline underline-offset-2">
                    {r.product?.name}
                  </Link>{" "}
                  · {new Date(r.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {tab === "PENDING" ? (
                  <>
                    <Button size="sm" magnetic={false} disabled={busy} onClick={() => act(r._id, "approve")}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="ghost" magnetic={false} disabled={busy} onClick={() => act(r._id, "reject")}>
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </>
                ) : (
                  <Badge variant={r.status === "APPROVED" ? "success" : "outline"}>{r.status}</Badge>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
