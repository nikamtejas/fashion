import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/products";
import { withCloudinaryTransform } from "@/lib/cloudinary";
import { FavoriteButton } from "./FavoriteButton";

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const primary = product.images.find((img) => img.isPrimary) ?? product.images[0];

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-black/5 dark:bg-white/5">
        <FavoriteButton productId={product.id} />
        {primary ? (
          <Image
            src={withCloudinaryTransform(primary.url, "f_auto,q_auto,w_800")}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-black/40 dark:text-white/40">
            No image
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="truncate text-sm font-medium">{product.name}</p>
        <p className="text-sm text-black/60 dark:text-white/60">₹{product.price}</p>
      </div>
    </Link>
  );
}
