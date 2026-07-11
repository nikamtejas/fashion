import { apiFetch } from "./api";

export type ImageStatus = "accepted" | "original";

export interface ProductVariant {
  _id?: string;
  size: string;
  color: string;
  sku: string;
  stock: number;
}

export interface ProductImage {
  _id?: string;
  originalPublicId: string;
  originalUrl: string;
  enhancedPublicId?: string;
  enhancedUrl?: string;
  geminiModel?: string;
  status: ImageStatus;
  isPrimary: boolean;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  tags: string[];
  stock: number;
  variants: ProductVariant[];
  price: number;
  images: ProductImage[];
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  description?: string;
  category: string;
  tags: string[];
  stock: number;
  variants: Omit<ProductVariant, "_id">[];
  price: number;
  images: Omit<ProductImage, "_id">[];
  status: "draft" | "published";
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function listProducts(params: { page?: number; limit?: number; status?: string } = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.status) query.set("status", params.status);
  const qs = query.toString();
  return apiFetch<PaginatedResult<Product>>(`/api/admin/products${qs ? `?${qs}` : ""}`);
}

export function getProduct(id: string) {
  return apiFetch<{ product: Product }>(`/api/admin/products/${id}`);
}

export function createProduct(input: ProductInput) {
  return apiFetch<{ product: Product }>("/api/admin/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProduct(id: string, input: Partial<ProductInput>) {
  return apiFetch<{ product: Product }>(`/api/admin/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteProduct(id: string) {
  return apiFetch<void>(`/api/admin/products/${id}`, { method: "DELETE" });
}

export interface EnhanceImageResult {
  original: { publicId: string; url: string };
  enhanced: { publicId: string; url: string; model: string } | null;
  enhanceError?: string;
}

export function enhanceImage(file: File, tier: "primary" | "fast") {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("tier", tier);
  return apiFetch<EnhanceImageResult>("/api/admin/images/enhance", {
    method: "POST",
    body: formData,
  });
}
