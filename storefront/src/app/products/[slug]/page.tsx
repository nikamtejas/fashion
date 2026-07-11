import { notFound } from "next/navigation";
import { getProduct } from "@/lib/products";
import { ApiRequestError } from "@/lib/api";
import { ProductDetailInteractive } from "@/components/products/ProductDetailInteractive";

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

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10">
      <ProductDetailInteractive product={product} />
    </div>
  );
}
