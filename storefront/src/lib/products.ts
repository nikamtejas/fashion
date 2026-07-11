import { apiFetch } from "./api";

export interface ProductVariant {
  size: string;
  color: string;
  stock: number;
}

export interface ProductImage {
  url: string;
  isPrimary: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  tags: string[];
  price: number;
  stock: number;
  variants: ProductVariant[];
  images: ProductImage[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function listProducts(params: { page?: number; limit?: number; category?: string } = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.category) query.set("category", params.category);
  const qs = query.toString();
  return apiFetch<PaginatedResult<Product>>(`/api/products${qs ? `?${qs}` : ""}`);
}

export function getProduct(slug: string) {
  return apiFetch<{ product: Product }>(`/api/products/${slug}`);
}
