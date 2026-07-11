export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Must match backend COOKIE_NAME (see backend/.env.example). Only the name is needed
// client-side to check for the cookie's presence — the value is httpOnly and opaque.
export const SESSION_COOKIE_NAME = "fp_session";
