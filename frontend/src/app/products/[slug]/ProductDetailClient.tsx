"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useCartStore } from "@/store/cartStore";
import { ProductGallery } from "@/components/product/ProductGallery";
import { EmiWidget } from "@/components/product/EmiWidget";
import { TryOnButton } from "@/components/product/TryOnModal";
import { AlertButtons } from "@/components/product/AlertButtons";
import { RecentlyViewedRail, recordView } from "@/components/product/RecentlyViewed";
import { SizeGuideModal } from "@/components/product/SizeGuideModal";
import { ShareButton } from "@/components/product/ShareButton";
import { CompleteTheLook } from "@/components/product/CompleteTheLook";
import { ReviewsSection } from "@/components/product/ReviewsSection";
import { cn } from "@/lib/utils";
import type { ProductDetail } from "./types";

export function ProductDetailClient({ product }: { product: ProductDetail }) {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const isFavorited = useFavoritesStore((s) => s.ids.has(product.id));
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const addItem = useCartStore((s) => s.addItem);
  const [adding, setAdding] = React.useState(false);
  // Tracks whether the inline "Add to bag" button (below) is still on
  // screen — once a shopper scrolls past it to read the description or
  // reviews, the fixed mobile bar takes over so buying never requires
  // scrolling back up.
  const [inlineCtaVisible, setInlineCtaVisible] = React.useState(true);
  const inlineCtaRef = React.useRef<HTMLDivElement>(null);

  const [sizeGuideOpen, setSizeGuideOpen] = React.useState(false);

  React.useEffect(() => {
    const el = inlineCtaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInlineCtaVisible(entry.isIntersecting), {
      rootMargin: "-64px 0px 0px 0px", // account for the sticky navbar
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    recordView(product.slug);
  }, [product.slug]);
  const sizes = [...new Set(product.variants.map((v) => v.size))];
  const colors = [...new Map(product.variants.map((v) => [v.color, v.colorHex])).entries()];
  const [selectedSize, setSelectedSize] = React.useState<string | null>(sizes[0] ?? null);
  const [selectedColor, setSelectedColor] = React.useState<string | null>(colors[0]?.[0] ?? null);

  // If the selected color has its own tagged photos, the gallery shows only
  // those (admin uploads up to 4 per color); otherwise fall back to the
  // full default set shared across colors.
  const colorPhotos = selectedColor ? product.images.filter((img) => img.color === selectedColor) : [];
  const baseImages = colorPhotos.length > 0 ? colorPhotos : product.images;

  // Prefer AI-enhanced shots, but fall back to the original photos —
  // seeded products only have ORIGINAL images. An admin-chosen cover is
  // always included (even if it's an ORIGINAL) and leads the gallery.
  const enhanced = baseImages.filter((img) => img.type !== "ORIGINAL" || img.isCover);
  const galleryImages = [...(enhanced.length > 0 ? enhanced : baseImages)]
    .sort((a, b) => Number(b.isCover ?? false) - Number(a.isCover ?? false) || a.order - b.order)
    .map((img) => ({ url: img.url, altText: img.altText, type: img.type }));

  const selectedVariant = product.variants.find((v) => v.size === selectedSize && v.color === selectedColor);
  const inStock = (selectedVariant?.stock ?? 0) > 0;
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);

  /** Micro-delight: a dot flies from the button to the cart icon. */
  function flyToCart(from: HTMLElement) {
    const cartIcon = document.querySelector('[aria-label="Cart"]');
    if (!cartIcon) return;
    const a = from.getBoundingClientRect();
    const b = cartIcon.getBoundingClientRect();
    const dot = document.createElement("span");
    dot.setAttribute("aria-hidden", "true");
    Object.assign(dot.style, {
      position: "fixed",
      left: `${a.left + a.width / 2}px`,
      top: `${a.top + a.height / 2}px`,
      width: "14px",
      height: "14px",
      borderRadius: "9999px",
      background: "#C15B3C",
      zIndex: "60",
      pointerEvents: "none",
      transition: "transform 0.7s cubic-bezier(.2,.7,.3,1), opacity 0.7s ease",
    });
    document.body.appendChild(dot);
    requestAnimationFrame(() => {
      dot.style.transform = `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(0.3)`;
      dot.style.opacity = "0";
    });
    setTimeout(() => dot.remove(), 750);
  }

  async function handleAddToBag(event: React.MouseEvent<HTMLButtonElement>) {
    if (!selectedVariant) {
      toast({ title: "Select a size and color", variant: "error" });
      return;
    }
    if (!user) {
      router.push(`/login?callbackUrl=/products/${product.slug}`);
      return;
    }
    flyToCart(event.currentTarget);
    setAdding(true);
    try {
      await addItem(product.id, selectedVariant.sku);
    } catch (err) {
      toast({ title: "Couldn't add to bag", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setAdding(false);
    }
  }

  const [favBusy, setFavBusy] = React.useState(false);

  async function handleFavorite() {
    if (!user) {
      router.push(`/login?callbackUrl=/products/${product.slug}`);
      return;
    }
    if (favBusy) return;
    setFavBusy(true);
    try {
      await toggleFavorite(product.id);
    } catch {
      // toggleFavorite() already rolled back the optimistic store update.
    } finally {
      setFavBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <ProductGallery
          key={selectedColor ?? "all"}
          images={galleryImages.length > 0 ? galleryImages : [{ url: "", type: "ORIGINAL" }]}
        />

        <div>
          <p className="text-xs uppercase tracking-widest text-foreground/50">{product.brand}</p>
          <h1 className="font-display mt-1 text-3xl">{product.name}</h1>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-xl">₹{product.pricing.finalPrice.toLocaleString("en-IN")}</span>
            {product.pricing.mrp && product.pricing.mrp > product.pricing.finalPrice && (
              <span className="text-sm text-foreground/40 line-through">₹{product.pricing.mrp.toLocaleString("en-IN")}</span>
            )}
          </div>
          {product.ratingCount > 0 && (
            <p className="mt-1 text-sm text-foreground/50">
              ★ {product.ratingAvg.toFixed(1)} ({product.ratingCount} reviews)
            </p>
          )}

          <div className="mt-4 max-w-md">
            <EmiWidget amount={product.pricing.finalPrice} />
          </div>

          <p className="mt-6 max-w-md text-sm leading-relaxed text-foreground/70">{product.description}</p>

          {colors.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Color</p>
              <div className="mt-2 flex gap-2">
                {colors.map(([name, hex]) => (
                  <button
                    key={name}
                    onClick={() => setSelectedColor(name)}
                    title={name}
                    className={cn(
                      "h-8 w-8 rounded-full border-2",
                      selectedColor === name ? "scale-110 border-accent" : "border-border"
                    )}
                    style={{ backgroundColor: hex ?? "#ccc" }}
                  />
                ))}
              </div>
            </div>
          )}

          {sizes.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Size</p>
                <button onClick={() => setSizeGuideOpen(true)} className="text-xs text-foreground/50 underline underline-offset-2">
                  Size guide
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={cn(
                      "h-10 min-w-10 rounded-full border px-3 text-sm",
                      selectedSize === s ? "border-ink bg-ink text-ivory dark:border-ivory dark:bg-ivory dark:text-ink" : "border-border"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 text-xs text-foreground/50">
            {totalStock === 0
              ? "Out of stock"
              : selectedVariant
                ? selectedVariant.stock <= 5
                  ? `Only ${selectedVariant.stock} left`
                  : "In stock"
                : "Select a size"}
          </p>

          <div ref={inlineCtaRef} className="mt-6 flex gap-3">
            <Button size="lg" className="flex-1" onClick={handleAddToBag} disabled={!inStock || adding}>
              {adding ? "Adding…" : inStock ? "Add to bag" : "Out of stock"}
            </Button>
            <button
              onClick={handleFavorite}
              disabled={favBusy}
              aria-label="Favorite"
              className="flex h-14 w-14 items-center justify-center rounded-full border border-border disabled:opacity-50"
            >
              <Heart className={cn("h-5 w-5", isFavorited && "fill-sienna text-sienna")} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <ShareButton title={product.name} />
            <TryOnButton slug={product.slug} />
          </div>

          <div className="mt-3">
            <AlertButtons productId={product.id} inStock={totalStock > 0} />
          </div>
        </div>
      </div>

      <CompleteTheLook slug={product.slug} />
      <RecentlyViewedRail excludeSlug={product.slug} />
      <ReviewsSection slug={product.slug} />

      <SizeGuideModal open={sizeGuideOpen} onOpenChange={setSizeGuideOpen} />

      <AnimatePresence>
        {!inlineCtaVisible && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-md lg:hidden"
          >
            <div className="mx-auto flex max-w-7xl items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{product.name}</p>
                <p className="text-sm text-foreground/60">₹{product.pricing.finalPrice.toLocaleString("en-IN")}</p>
              </div>
              <Button size="lg" onClick={handleAddToBag} disabled={!inStock || adding}>
                {adding ? "Adding…" : inStock ? "Add to bag" : "Out of stock"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
