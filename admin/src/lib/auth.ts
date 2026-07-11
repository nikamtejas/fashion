import { apiFetch, ApiRequestError } from "./api";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  whatsappNumber: string | null;
  role: "customer" | "admin";
}

export function fetchMe(): Promise<{ user: SessionUser }> {
  return apiFetch("/api/auth/me");
}

export function logout(): Promise<void> {
  return apiFetch("/api/auth/logout", { method: "POST" });
}

// The backend's /login endpoint authenticates any role — this portal only admits
// admins, so a successful non-admin login is immediately logged out again.
export async function adminLogin(email: string, password: string): Promise<{ user: SessionUser }> {
  const result = await apiFetch<{ user: SessionUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (result.user.role !== "admin") {
    await logout();
    throw new ApiRequestError(403, "This portal is for admin accounts only.");
  }

  return result;
}
