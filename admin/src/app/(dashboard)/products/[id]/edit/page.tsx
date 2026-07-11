"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProductForm } from "@/components/products/ProductForm";
import { getProduct, updateProduct, type Product } from "@/lib/products";
import { ApiRequestError } from "@/lib/api";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProduct(id)
      .then((res) => setProduct(res.product))
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : "Failed to load product"));
  }, [id]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!product) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <div className="h-8 w-64 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="h-64 w-full animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Edit product</h1>
      <div className="mt-6">
        <ProductForm
          initial={product}
          onSubmit={async (input) => {
            const { product: updated } = await updateProduct(id, input);
            return { slug: updated.slug };
          }}
        />
      </div>
    </div>
  );
}
