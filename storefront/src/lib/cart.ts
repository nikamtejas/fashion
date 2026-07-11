import { apiFetch } from "./api";

export interface CartLine {
  itemId: string;
  productId: string;
  productName: string;
  productSlug: string;
  imageUrl: string | null;
  variantSku?: string;
  size?: string;
  color?: string;
  category: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
  availableStock: number;
}

export interface CartData {
  items: CartLine[];
  subtotal: number;
  coupon: { code: string; type: "flat" | "percentage"; value: number; discount: number } | null;
  discount: number;
  total: number;
}

export function getCart() {
  return apiFetch<CartData>("/api/cart");
}

export function addCartItem(input: { productId: string; variantSku?: string; qty?: number }) {
  return apiFetch<CartData>("/api/cart/items", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCartItem(itemId: string, qty: number) {
  return apiFetch<CartData>(`/api/cart/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ qty }),
  });
}

export function removeCartItem(itemId: string) {
  return apiFetch<CartData>(`/api/cart/items/${itemId}`, { method: "DELETE" });
}

export function applyCoupon(code: string) {
  return apiFetch<CartData>("/api/cart/coupon", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function removeCoupon() {
  return apiFetch<CartData>("/api/cart/coupon", { method: "DELETE" });
}
