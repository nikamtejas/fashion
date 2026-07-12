export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ApiFetchOptions extends RequestInit {
  json?: unknown;
}

/** Error responses carry a human message plus optional machine fields the
 * backend sets for flow control (e.g. code: "NOT_REGISTERED" on login). */
export class ApiError extends Error {
  status: number;
  code?: string;
  field?: string;

  constructor(message: string, status: number, code?: string, field?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

/**
 * Fetch wrapper for calling the LuxeLoom backend. Always sends cookies
 * (`credentials: "include"`) so the httpOnly session cookie set by the
 * backend's own origin is attached to cross-origin requests.
 */
export async function apiFetch<T = unknown>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const { json, headers, ...rest } = opts;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json ? JSON.stringify(json) : rest.body,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `Request failed with ${res.status}`, res.status, body.code, body.field);
  }

  return res.json() as Promise<T>;
}
