"use client";

import { useState } from "react";
import Image from "next/image";
import type { Product } from "@/lib/products";
import { withCloudinaryTransform } from "@/lib/cloudinary";
import { AddToCartForm } from "./AddToCartForm";

export function ProductDetailInteractive({ product }: { product: Product }) {
  const colors = Array.from(new Set(product.variants.map((v) => v.color))).filter(Boolean);
  const [color, setColor] = useState<string | null>(colors[0] ?? null);

  // Images tagged for the selected color, plus any untagged (generic) images — so
  // admin doesn't have to tag every photo for the gallery to still make sense.
  const filteredImages = color
    ? product.images.filter((img) => !img.color || img.color === color)
    : product.images;
  const galleryImages = filteredImages.length > 0 ? filteredImages : product.images;

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        {galleryImages.length > 0 ? (
          galleryImages.map((img, i) => (
            <div
              key={img.url}
              className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-black/5 dark:bg-white/5"
            >
              <Image
                src={withCloudinaryTransform(img.url, "f_auto,q_auto,w_1200")}
                alt={product.name}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
                priority={i === 0}
              />
            </div>
          ))
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center rounded-lg bg-black/5 text-sm text-black/40 dark:bg-white/5 dark:text-white/40">
            No image
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
          {product.category}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>
        <p className="mt-3 text-xl font-medium">₹{product.price}</p>

        {product.description && (
          <p className="mt-4 text-sm text-black/70 dark:text-white/70">{product.description}</p>
        )}

        <AddToCartForm product={product} color={color} onColorChange={setColor} />
      </div>
    </div>
  );
}
