/** NEXT_PUBLIC_API_URL may list several origins (comma-separated) so the same
 * build works on localhost and over the LAN (phone testing). The backend must
 * be reached on the same host the page was opened on, or its CORS/cookie
 * origin won't match — so pick the entry matching the browser's hostname. */
const API_URLS = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000")
  .split(",")
  .map((url) => url.trim().replace(/\/+$/, ""))
  .filter(Boolean);

function pickApiUrl(): string {
  if (typeof window !== "undefined") {
    const match = API_URLS.find((url) => {
      try {
        return new URL(url).hostname === window.location.hostname;
      } catch {
        return false;
      }
    });
    if (match) return match;
  }
  return API_URLS[0];
}

export const API_URL = pickApiUrl();

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

const getCache = new Map<string, { data: unknown; expiresAt: number }>();

/**
 * apiFetch with a short in-memory cache, for GET data that barely changes
 * (categories, lookbooks, store lists). Every backend round trip currently
 * costs ~1s+, and client components re-fetch this on every mount — this
 * cuts that down to once per `ttlMs` window per browser session instead of
 * once per page visit.
 */
export async function cachedApiFetch<T = unknown>(path: string, ttlMs = 5 * 60 * 1000): Promise<T> {
  const hit = getCache.get(path);
  if (hit && hit.expiresAt > Date.now()) return hit.data as T;
  const data = await apiFetch<T>(path);
  getCache.set(path, { data, expiresAt: Date.now() + ttlMs });
  return data;
}
