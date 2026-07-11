import { apiFetch } from "./api";

export interface OrderItem {
  productId: string;
  variantSku?: string;
  name: string;
  size?: string;
  color?: string;
  price: number;
  qty: number;
}

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface Order {
  _id: string;
  items: OrderItem[];
  subtotal: number;
  couponCode?: string;
  discount: number;
  total: number;
  payment: {
    method: "razorpay" | "cod";
    status: "pending" | "captured" | "failed";
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpayMethod?: string;
  };
  shippingAddress: ShippingAddress;
  whatsappNumber?: string;
  shipping: { dhlTrackingId?: string; status: string };
  status: "placed" | "confirmed" | "shipped" | "delivered" | "cancelled" | "returned";
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateRazorpayCheckoutResult {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export function createRazorpayCheckout() {
  return apiFetch<CreateRazorpayCheckoutResult>("/api/orders/razorpay/create", { method: "POST" });
}

export function verifyRazorpayCheckout(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  shippingAddress: ShippingAddress;
  whatsappNumber: string;
}) {
  return apiFetch<{ order: Order }>("/api/orders/razorpay/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function placeCodOrder(input: { shippingAddress: ShippingAddress; whatsappNumber: string }) {
  return apiFetch<{ order: Order }>("/api/orders/cod", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listOrders(params: { page?: number; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return apiFetch<PaginatedResult<Order>>(`/api/orders${qs ? `?${qs}` : ""}`);
}

export function getOrder(id: string) {
  return apiFetch<{ order: Order }>(`/api/orders/${id}`);
}
