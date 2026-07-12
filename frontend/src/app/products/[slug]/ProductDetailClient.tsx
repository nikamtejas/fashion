"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useCartStore } from "@/store/cartStore";
import { ProductGallery } from "@/components/product/ProductGallery";
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

  const [sizeGuideOpen, setSizeGuideOpen] = React.useState(false);
  const sizes = [...new Set(product.variants.map((v) => v.size))];
  const colors = [...new Map(product.variants.map((v) => [v.color, v.colorHex])).entries()];
  const [selectedSize, setSelectedSize] = React.useState<string | null>(sizes[0] ?? null);
  const [selectedColor, setSelectedColor] = React.useState<string | null>(colors[0]?.[0] ?? null);

  const galleryImages = [...product.images]
    .filter((img) => img.type !== "ORIGINAL")
    .sort((a, b) => a.order - b.order)
    .map((img) => ({ url: img.url, altText: img.altText, type: img.type }));

  const selectedVariant = product.variants.find((v) => v.size === selectedSize && v.color === selectedColor);
  const inStock = (selectedVariant?.stock ?? 0) > 0;
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);

  async function handleAddToBag() {
    if (!selectedVariant) {
      toast({ title: "Select a size and color", variant: "error" });
      return;
    }
    if (!user) {
      router.push(`/login?callbackUrl=/products/${product.slug}`);
      return;
    }
    setAdding(true);
    try {
      await addItem(product.id, selectedVariant.sku);
    } catch (err) {
      toast({ title: "Couldn't add to bag", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setAdding(false);
    }
  }

  function handleFavorite() {
    if (!user) {
      router.push(`/login?callbackUrl=/products/${product.slug}`);
      return;
    }
    toggleFavorite(product.id);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <ProductGallery images={galleryImages.length > 0 ? galleryImages : [{ url: "", type: "ORIGINAL" }]} />

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

          <div className="mt-6 flex gap-3">
            <Button size="lg" className="flex-1" onClick={handleAddToBag} disabled={!inStock || adding}>
              {adding ? "Adding…" : inStock ? "Add to bag" : "Out of stock"}
            </Button>
            <button
              onClick={handleFavorite}
              aria-label="Favorite"
              className="flex h-14 w-14 items-center justify-center rounded-full border border-border"
            >
              <Heart className={cn("h-5 w-5", isFavorited && "fill-sienna text-sienna")} />
            </button>
          </div>

          <div className="mt-4">
            <ShareButton title={product.name} />
          </div>
        </div>
      </div>

      <CompleteTheLook slug={product.slug} />
      <ReviewsSection slug={product.slug} />

      <SizeGuideModal open={sizeGuideOpen} onOpenChange={setSizeGuideOpen} />
    </div>
  );
}
