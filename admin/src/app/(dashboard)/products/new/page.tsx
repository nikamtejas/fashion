"use client";

import { ProductForm } from "@/components/products/ProductForm";
import { createProduct } from "@/lib/products";

export default function NewProductPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">New product</h1>
      <div className="mt-6">
        <ProductForm
          onSubmit={async (input) => {
            const { product } = await createProduct(input);
            return { slug: product.slug };
          }}
        />
      </div>
    </div>
  );
}
