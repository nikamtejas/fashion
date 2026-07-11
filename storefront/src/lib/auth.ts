import { apiFetch } from "./api";

export interface Address {
  id: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  whatsappNumber: string | null;
  role: "customer" | "admin";
  addresses: Address[];
}

export function fetchMe(): Promise<{ user: SessionUser }> {
  return apiFetch("/api/auth/me");
}

export function login(email: string, password: string): Promise<{ user: SessionUser }> {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function signup(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<{ user: SessionUser }> {
  return apiFetch("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logout(): Promise<void> {
  return apiFetch("/api/auth/logout", { method: "POST" });
}

export function addAddress(input: {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}): Promise<{ user: SessionUser }> {
  return apiFetch("/api/auth/addresses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
