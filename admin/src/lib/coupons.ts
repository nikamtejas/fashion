import { apiFetch } from "./api";

export interface Coupon {
  _id: string;
  code: string;
  type: "flat" | "percentage";
  value: number;
  maxDiscount?: number;
  minCartValue: number;
  expiresAt?: string;
  usageLimit?: number;
  usedCount: number;
  applicableCategories: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CouponInput {
  code: string;
  type: "flat" | "percentage";
  value: number;
  maxDiscount?: number;
  minCartValue: number;
  expiresAt?: string;
  usageLimit?: number;
  applicableCategories: string[];
  active: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function listCoupons(params: { page?: number; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return apiFetch<PaginatedResult<Coupon>>(`/api/admin/coupons${qs ? `?${qs}` : ""}`);
}

export function getCoupon(id: string) {
  return apiFetch<{ coupon: Coupon }>(`/api/admin/coupons/${id}`);
}

export function createCoupon(input: CouponInput) {
  return apiFetch<{ coupon: Coupon }>("/api/admin/coupons", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCoupon(id: string, input: Partial<CouponInput>) {
  return apiFetch<{ coupon: Coupon }>(`/api/admin/coupons/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteCoupon(id: string) {
  return apiFetch<void>(`/api/admin/coupons/${id}`, { method: "DELETE" });
}
