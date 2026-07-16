"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { cachedApiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface LookProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  image: string | null;
  firstInStockSku: string | null;
}

interface Look {
  id: string;
  title: string;
  description?: string;
  products: LookProduct[];
}

export default function LookbooksPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const addItem = useCartStore((s) => s.addItem);
  const [looks, setLooks] = React.useState<Look[] | null>(null);
  const [addingId, setAddingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Lookbook curation barely changes; a short cache avoids re-fetching on
    // every visit while still picking up stock/price updates within a minute.
    cachedApiFetch<{ lookbooks: Look[] }>("/api/lookbooks", 60_000).then((d) => setLooks(d.lookbooks));
  }, []);

  async function addLook(look: Look) {
    if (!user) {
      router.push("/login?callbackUrl=/lookbooks");
      return;
    }
    setAddingId(look.id);
    let added = 0;
    let skipped = 0;
    try {
      for (const p of look.products) {
        if (!p.firstInStockSku) {
          skipped++;
          continue;
        }
        try {
          await addItem(p.id, p.firstInStockSku);
          added++;
        } catch {
          skipped++;
        }
      }
      toast({
        title: `${added} item${added === 1 ? "" : "s"} added to your bag`,
        description: skipped > 0 ? `${skipped} out-of-stock item${skipped === 1 ? "" : "s"} skipped.` : "The whole look, one tap.",
        variant: added > 0 ? "success" : "error",
      });
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-sienna">Shop the look</p>
      <h1 className="font-display mt-2 text-3xl">Lookbooks</h1>

      {looks === null && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      )}
      {looks?.length === 0 && <p className="mt-10 text-sm text-foreground/50">Lookbooks are being styled — check back soon.</p>}

      <div className="mt-10 space-y-12">
        {looks?.map((look) => (
          <section key={look.id} className="rounded-3xl border border-border p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl">{look.title}</h2>
                {look.description && <p className="mt-1 max-w-xl text-sm text-foreground/60">{look.description}</p>}
                <p className="mt-1 text-xs text-foreground/50">
                  {look.products.length} pieces · ₹
                  {look.products.reduce((s, p) => s + p.price, 0).toLocaleString("en-IN")} for the full look
                </p>
              </div>
              <Button disabled={addingId === look.id} onClick={() => addLook(look)}>
                <ShoppingBag className="h-4 w-4" />
                {addingId === look.id ? "Adding…" : "Add entire look"}
              </Button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {look.products.map((p) => (
                <Link key={p.id} href={`/products/${p.slug}`} className="group">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-foreground/5">
                    {p.image && (
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        sizes="(min-width: 640px) 25vw, 50vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    {!p.firstInStockSku && (
                      <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ivory">
                        Out of stock
                      </span>
                    )}
                  </div>
                  <p className="mt-2 truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-foreground/50">₹{p.price.toLocaleString("en-IN")}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
