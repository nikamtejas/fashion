"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Heart } from "lucide-react";
import { API_URL, apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface FavoriteProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  mrp?: number;
  image: string | null;
  inStock: boolean;
  status: string;
}

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const toggle = useFavoritesStore((s) => s.toggle);
  const addItem = useCartStore((s) => s.addItem);
  const [favorites, setFavorites] = React.useState<FavoriteProduct[] | null>(null);

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?callbackUrl=/favorites");
    }
  }, [authLoading, user, router]);

  React.useEffect(() => {
    if (!user) return;
    apiFetch<{ favorites: FavoriteProduct[] }>("/api/favorites")
      .then((data) => setFavorites(data.favorites))
      .catch(() => setFavorites([]));
  }, [user]);

  async function handleRemove(id: string) {
    try {
      await toggle(id);
      setFavorites((prev) => prev?.filter((f) => f.id !== id) ?? null);
    } catch (err) {
      toast({ title: "Couldn't remove favorite", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }

  async function handleMoveToCart(product: FavoriteProduct) {
    try {
      // Favorites don't carry a size — add the first in-stock variant.
      const res = await fetch(
        `${API_URL}/api/products/${product.slug}`
      );
      const data = await res.json();
      const variant = (data.product?.variants ?? []).find((v: { stock: number }) => v.stock > 0);
      if (!variant) {
        toast({ title: "Out of stock", description: product.name, variant: "error" });
        return;
      }
      await addItem(product.id, variant.sku);
    } catch (err) {
      toast({ title: "Couldn't move to bag", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }

  const ready = !authLoading && !!user;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl">Favorites</h1>

      {(!ready || favorites === null) && (
        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full" />
          ))}
        </div>
      )}

      {ready && favorites?.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center">
          <Heart className="h-10 w-10 text-foreground/20" />
          <p className="mt-4 text-sm text-foreground/50">Nothing saved yet — tap the heart on any product.</p>
          <Button asChild className="mt-6">
            <Link href="/shop">Browse the shop</Link>
          </Button>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3">
        {favorites?.map((p) => (
          <div key={p.id}>
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-foreground/5">
              <Link href={`/products/${p.slug}`}>
                {p.image && (
                  <Image src={p.image} alt={p.name} fill sizes="(min-width: 640px) 33vw, 50vw" className="object-cover" />
                )}
              </Link>
              <button
                onClick={() => handleRemove(p.id)}
                aria-label="Remove from favorites"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink shadow-md"
              >
                <Heart className="h-4 w-4 fill-sienna text-sienna" />
              </button>
            </div>
            <p className="mt-3 text-sm font-medium">{p.name}</p>
            <p className="text-sm text-foreground/60">₹{p.price.toLocaleString("en-IN")}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full"
              magnetic={false}
              disabled={!p.inStock}
              onClick={() => handleMoveToCart(p)}
            >
              {p.inStock ? "Move to bag" : "Out of stock"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
