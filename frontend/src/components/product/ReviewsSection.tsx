"use client";

import * as React from "react";
import { Star, BadgeCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { fileToDataUri } from "@/lib/imageQuality";

interface Review {
  id: string;
  rating: number;
  title?: string;
  body: string;
  photos: { secureUrl: string }[];
  verifiedPurchase: boolean;
  userName: string;
  createdAt: string;
}

function Stars({ rating, size = "h-4 w-4" }: { rating: number; size?: string }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(size, i <= rating ? "fill-sienna text-sienna" : "text-border")} />
      ))}
    </div>
  );
}

export function ReviewsSection({ slug }: { slug: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = React.useState<Review[] | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [rating, setRating] = React.useState(5);
  const [body, setBody] = React.useState("");
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    apiFetch<{ reviews: Review[] }>(`/api/products/${slug}/reviews`).then((data) => setReviews(data.reviews));
  }, [slug]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/products/${slug}/reviews`, { method: "POST", json: { rating, body, photoDataUris: photos } });
      toast({ title: "Review submitted", description: "It'll appear once our team approves it.", variant: "success" });
      setBody("");
      setPhotos([]);
      setShowForm(false);
      load();
    } catch (err) {
      toast({ title: "Couldn't post review", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-20 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Reviews</h2>
        {user && !showForm && (
          <Button size="sm" variant="outline" magnetic={false} onClick={() => setShowForm(true)}>
            Write a review
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-xl border border-border p-4">
          <Stars rating={rating} size="h-5 w-5" />
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" onClick={() => setRating(i)} className="text-lg">
                {i <= rating ? "★" : "☆"}
              </button>
            ))}
          </div>
          <textarea
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts…"
            rows={3}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <div>
            <label className="text-xs text-foreground/50">Add photos (up to 4)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              className="mt-1 block text-xs"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []).slice(0, 4);
                const uris: string[] = [];
                for (const f of files) uris.push(await fileToDataUri(f));
                setPhotos(uris);
              }}
            />
            {photos.length > 0 && (
              <div className="mt-2 flex gap-2">
                {photos.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={p} alt="" className="h-14 w-14 rounded-lg object-cover" />
                ))}
              </div>
            )}
          </div>
          <Button type="submit" size="sm" disabled={submitting} magnetic={false}>
            {submitting ? "Posting…" : "Post review"}
          </Button>
        </form>
      )}

      <div className="mt-6 space-y-6">
        {reviews === null &&
          // Reserve roughly the shape of 2 review cards instead of nothing
          // rendering below the heading until the fetch resolves — avoids
          // the footer (and anything else below) jumping up then back down.
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border-t border-border pt-6 first:border-t-0 first:pt-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-2/3" />
            </div>
          ))}
        {reviews?.length === 0 && <p className="text-sm text-foreground/50">No reviews yet — be the first.</p>}
        {reviews?.map((r) => (
          <div key={r.id} className="border-t border-border pt-6 first:border-t-0 first:pt-0">
            <div className="flex items-center gap-2">
              <Stars rating={r.rating} />
              {r.verifiedPurchase && (
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-sage-dark)]">
                  <BadgeCheck className="h-3 w-3" /> Verified purchase
                </span>
              )}
            </div>
            {r.title && <p className="mt-2 text-sm font-medium">{r.title}</p>}
            <p className="mt-1 text-sm text-foreground/70">{r.body}</p>
            {r.photos.length > 0 && (
              <div className="mt-2 flex gap-2">
                {r.photos.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={p.secureUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-foreground/40">{r.userName}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
