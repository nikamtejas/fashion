"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageEnhancer, type ResolvedImage } from "./ImageEnhancer";
import { PricingCalculator } from "./PricingCalculator";
import type { Product, ProductInput, ProductVariant } from "@/lib/products";
import type { PricingInput } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { ApiRequestError } from "@/lib/api";

interface GalleryImage extends ResolvedImage {
  isPrimary: boolean;
  color?: string;
}

function toGalleryImages(product?: Product): GalleryImage[] {
  if (!product) return [];
  return product.images.map((img) => ({
    originalPublicId: img.originalPublicId,
    originalUrl: img.originalUrl,
    enhancedPublicId: img.enhancedPublicId,
    enhancedUrl: img.enhancedUrl,
    geminiModel: img.geminiModel,
    status: img.status,
    isPrimary: img.isPrimary,
    color: img.color,
  }));
}

export function ProductForm({
  initial,
  onSubmit,
}: {
  initial?: Product;
  onSubmit: (input: ProductInput) => Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [stock, setStock] = useState(String(initial?.stock ?? 0));
  const [pricing, setPricing] = useState<PricingInput>(
    initial
      ? {
          purchasePrice: initial.pricing.purchasePrice,
          fixedCost: initial.pricing.fixedCost,
          marginPct: initial.pricing.marginPct,
          gstThreshold: initial.pricing.gstThreshold,
          gstRateLow: initial.pricing.gstRateLow,
          gstRateHigh: initial.pricing.gstRateHigh,
        }
      : { purchasePrice: 0, fixedCost: 0, marginPct: 0, gstThreshold: 0, gstRateLow: 0, gstRateHigh: 0 }
  );
  const [variants, setVariants] = useState<Omit<ProductVariant, "_id">[]>(
    initial?.variants.map((v) => ({ size: v.size, color: v.color, sku: v.sku, stock: v.stock })) ?? []
  );
  const [images, setImages] = useState<GalleryImage[]>(toGalleryImages(initial));
  const [status, setStatus] = useState<"draft" | "published">(initial?.status ?? "draft");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initial) return; // editing an existing product keeps its own snapshotted GST values
    getSettings()
      .then(({ settings }) => {
        setPricing((prev) => ({
          ...prev,
          gstThreshold: settings.gstThreshold,
          gstRateLow: settings.gstRateLow,
          gstRateHigh: settings.gstRateHigh,
        }));
      })
      .catch(() => {
        // Non-fatal — admin can still type GST values manually.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount for new products only
  }, []);

  function addVariant() {
    setVariants((prev) => [...prev, { size: "", color: "", sku: "", stock: 0 }]);
  }

  function updateVariant(index: number, patch: Partial<Omit<ProductVariant, "_id">>) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function removeVariant(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  function addImage(image: ResolvedImage) {
    setImages((prev) => [...prev, { ...image, isPrimary: prev.length === 0 }]);
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((img) => img.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  }

  function makePrimary(index: number) {
    setImages((prev) => prev.map((img, i) => ({ ...img, isPrimary: i === index })));
  }

  function updateImageColor(index: number, color: string) {
    setImages((prev) => prev.map((img, i) => (i === index ? { ...img, color: color || undefined } : img)));
  }

  const variantColors = Array.from(new Set(variants.map((v) => v.color.trim()).filter(Boolean)));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (status === "published" && images.length === 0) {
      setError("Published products need at least one image.");
      return;
    }

    setIsSubmitting(true);
    try {
      const input: ProductInput = {
        name: name.trim(),
        category: category.trim(),
        description: description.trim() || undefined,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        stock: Number(stock) || 0,
        pricing,
        variants,
        images: images.map(
          ({ originalPublicId, originalUrl, enhancedPublicId, enhancedUrl, geminiModel, status: imgStatus, isPrimary, color }) => ({
            originalPublicId,
            originalUrl,
            enhancedPublicId,
            enhancedUrl,
            geminiModel,
            status: imgStatus,
            isPrimary,
            color,
          })
        ),
        status,
      };
      const result = await onSubmit(input);
      router.push("/products");
      router.refresh();
      void result;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-3xl flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-11 rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Category
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            placeholder="e.g. Men, Women, Kids, Accessories"
            className="h-11 rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Tags (comma-separated)
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="denim, summer, casual"
            className="h-11 rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Stock
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="h-11 rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
          />
        </label>

      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Pricing</h2>
        <PricingCalculator value={pricing} onChange={setPricing} />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Variants</h2>
          <button
            type="button"
            onClick={addVariant}
            className="text-sm font-medium underline underline-offset-2"
          >
            + Add variant
          </button>
        </div>
        {variants.length === 0 && (
          <p className="text-sm text-black/50 dark:text-white/50">No variants yet.</p>
        )}
        <div className="flex flex-col gap-2">
          {variants.map((variant, index) => (
            <div key={index} className="grid grid-cols-2 gap-2 rounded-lg border border-black/10 p-3 dark:border-white/10 sm:grid-cols-5">
              <input
                value={variant.size}
                onChange={(e) => updateVariant(index, { size: e.target.value })}
                placeholder="Size"
                className="h-9 rounded-md border border-black/15 bg-transparent px-2 text-sm dark:border-white/20"
              />
              <input
                value={variant.color}
                onChange={(e) => updateVariant(index, { color: e.target.value })}
                placeholder="Color"
                className="h-9 rounded-md border border-black/15 bg-transparent px-2 text-sm dark:border-white/20"
              />
              <input
                value={variant.sku}
                onChange={(e) => updateVariant(index, { sku: e.target.value })}
                placeholder="SKU"
                className="h-9 rounded-md border border-black/15 bg-transparent px-2 text-sm dark:border-white/20"
              />
              <input
                type="number"
                min={0}
                value={variant.stock}
                onChange={(e) => updateVariant(index, { stock: Number(e.target.value) || 0 })}
                placeholder="Stock"
                className="h-9 rounded-md border border-black/15 bg-transparent px-2 text-sm dark:border-white/20"
              />
              <button
                type="button"
                onClick={() => removeVariant(index)}
                className="h-9 rounded-md text-sm font-medium text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Images</h2>
        <ImageEnhancer onResolved={addImage} />

        {images.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {images.map((img, index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <div className="relative overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin gallery thumbnail, arbitrary Cloudinary URL */}
                  <img
                    src={img.status === "accepted" ? img.enhancedUrl : img.originalUrl}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 p-1.5">
                    <button
                      type="button"
                      onClick={() => makePrimary(index)}
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        img.isPrimary ? "bg-white text-black" : "text-white"
                      }`}
                    >
                      {img.isPrimary ? "Primary" : "Set primary"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {variantColors.length > 0 && (
                  <select
                    value={img.color ?? ""}
                    onChange={(e) => updateImageColor(index, e.target.value)}
                    className="h-8 rounded-md border border-black/15 bg-transparent px-1.5 text-xs dark:border-white/20"
                  >
                    <option value="">All colors</option>
                    {variantColors.map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "published")}
            className="h-11 w-48 rounded-lg border border-black/15 bg-transparent px-3 text-sm dark:border-white/20"
          >
            <option value="draft">Draft (hidden from storefront)</option>
            <option value="published">Published</option>
          </select>
        </label>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-11 rounded-full bg-black px-6 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {isSubmitting ? "Saving…" : initial ? "Save changes" : "Create product"}
        </button>
      </div>
    </form>
  );
}
