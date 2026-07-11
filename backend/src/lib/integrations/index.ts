export const INTEGRATIONS_MOCK = process.env.INTEGRATIONS_MOCK !== "false";

export function logIntegrationCall(service: string, action: string, payload?: unknown) {
  const tag = INTEGRATIONS_MOCK ? "MOCK" : "LIVE";
  // eslint-disable-next-line no-console
  console.log(`[integrations:${tag}] ${service}.${action}`, payload ?? "");
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout!);
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 2, delayMs = 300, label = "call" }: { retries?: number; delayMs?: number; label?: string } = {}
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        logIntegrationCall("retry", label, { attempt, error: (err as Error)?.message });
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}
