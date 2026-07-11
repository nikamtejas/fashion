import { notFound } from "next/navigation";
import Image from "next/image";
import { getProduct } from "@/lib/products";
import { withCloudinaryTransform } from "@/lib/cloudinary";
import { ApiRequestError } from "@/lib/api";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let productResult;
  try {
    productResult = await getProduct(slug);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) {
      notFound();
    }
    throw err;
  }
  const { product } = productResult;

  const sizes = Array.from(new Set(product.variants.map((v) => v.size))).filter(Boolean);
  const colors = Array.from(new Set(product.variants.map((v) => v.color))).filter(Boolean);

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          {product.images.length > 0 ? (
            product.images.map((img, i) => (
              <div
                key={i}
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

          {sizes.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium">Size</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => (
                  <span
                    key={size}
                    className="rounded-full border border-black/15 px-3 py-1 text-sm dark:border-white/20"
                  >
                    {size}
                  </span>
                ))}
              </div>
            </div>
          )}

          {colors.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Color</p>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <span
                    key={color}
                    className="rounded-full border border-black/15 px-3 py-1 text-sm dark:border-white/20"
                  >
                    {color}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="mt-6 text-sm text-black/60 dark:text-white/60">
            {product.stock > 0 ? "In stock" : "Out of stock"}
          </p>

          <p className="mt-8 text-xs text-black/40 dark:text-white/40">
            Cart &amp; checkout are coming in Milestone 4.
          </p>
        </div>
      </div>
    </div>
  );
}
