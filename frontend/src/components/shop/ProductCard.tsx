"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import type { ShopProduct } from "./types";
import { QuickAddDrawer } from "./QuickAddDrawer";

export function ProductCard({ product, priority }: { product: ShopProduct; priority?: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const isFavorited = useFavoritesStore((s) => s.ids.has(product.id));
  const toggle = useFavoritesStore((s) => s.toggle);
  const [burst, setBurst] = React.useState(false);
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);

  function handleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    if (!user) {
      router.push("/login?callbackUrl=/shop");
      return;
    }
    if (!isFavorited) {
      setBurst(true);
      setTimeout(() => setBurst(false), 600);
    }
    toggle(product.id);
  }

  return (
    <div className="group relative">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-foreground/5">
          {product.image && (
            <Image
              src={product.image}
              alt={product.name}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className={cn(
                "object-cover transition-opacity duration-300",
                product.hoverImage && "group-hover:opacity-0"
              )}
            />
          )}
          {product.hoverImage && (
            <Image
              src={product.hoverImage}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          )}

          <button
            onClick={handleFavorite}
            aria-label="Favorite"
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur transition-transform hover:scale-110"
          >
            <Heart className={cn("h-4 w-4 transition-colors", isFavorited && "fill-sienna text-sienna")} />
            <AnimatePresence>
              {burst && (
                <motion.span
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 rounded-full border-2 border-sienna"
                />
              )}
            </AnimatePresence>
          </button>

          {!product.inStock ? (
            <span className="absolute left-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 text-[10px] uppercase tracking-wider text-ivory">
              Out of stock
            </span>
          ) : (
            product.mrp !== undefined &&
            product.mrp > product.price && (
              <span className="absolute left-3 top-3 rounded-full bg-sienna px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                {Math.round((1 - product.price / product.mrp) * 100)}% off
              </span>
            )
          )}

          <button
            onClick={(e) => {
              e.preventDefault();
              setQuickAddOpen(true);
            }}
            // Hover-reveal only makes sense with a mouse — on touch/tablet
            // (no real hover) and for keyboard users the button never got
            // group-hover, making Quick Add unreachable outside a desktop
            // mouse. Always shown below lg; hover/focus-reveal above it.
            className="absolute inset-x-3 bottom-3 translate-y-0 rounded-full bg-ink py-2.5 text-xs font-medium uppercase tracking-wider text-ivory opacity-100 transition-all duration-200 dark:bg-ivory dark:text-ink lg:translate-y-4 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-focus-within:translate-y-0 lg:group-focus-within:opacity-100"
          >
            Quick add
          </button>
        </div>

        <div className="mt-3">
          <p className="text-sm font-medium">{product.name}</p>
          <div className="mt-1 flex items-baseline gap-2 text-sm text-foreground/60">
            <span>₹{product.price.toLocaleString("en-IN")}</span>
            {product.mrp && product.mrp > product.price && (
              <span className="text-xs text-foreground/40 line-through">₹{product.mrp.toLocaleString("en-IN")}</span>
            )}
          </div>
        </div>
      </Link>

      <QuickAddDrawer product={product} open={quickAddOpen} onOpenChange={setQuickAddOpen} />
    </div>
  );
}
