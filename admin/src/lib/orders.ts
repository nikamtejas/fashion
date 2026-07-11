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

export interface Order {
  _id: string;
  userId: { _id: string; name: string; email: string } | string;
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
  shippingAddress: { line1: string; line2?: string; city: string; state: string; pincode: string };
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

export function listOrders(params: { page?: number; limit?: number; status?: string } = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.status) query.set("status", params.status);
  const qs = query.toString();
  return apiFetch<PaginatedResult<Order>>(`/api/admin/orders${qs ? `?${qs}` : ""}`);
}

export function getOrder(id: string) {
  return apiFetch<{ order: Order }>(`/api/admin/orders/${id}`);
}
