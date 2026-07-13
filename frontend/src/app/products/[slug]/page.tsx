import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { API_URL } from "@/lib/api";
import { ProductDetailClient } from "./ProductDetailClient";
import type { ProductDetail } from "./types";

async function getProduct(slug: string): Promise<ProductDetail | null> {
  try {
    // Same tradeoff as the home page — checkout re-validates stock/price
    // server-side, so a short cache here is safe and cuts a live round trip
    // off every product page visit.
    const res = await fetch(`${API_URL}/api/products/${slug}`, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.product;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product not found — LuxeLoom" };
  return {
    title: `${product.name} — LuxeLoom`,
    description: product.description,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  return <ProductDetailClient product={product} />;
}
