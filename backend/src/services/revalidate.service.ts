import { env } from "../config/env.js";

export async function revalidateStorefront(slug?: string): Promise<void> {
  if (!env.STOREFRONT_REVALIDATE_URL || !env.REVALIDATE_SECRET) return;

  try {
    await fetch(env.STOREFRONT_REVALIDATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": env.REVALIDATE_SECRET,
      },
      body: JSON.stringify({ slug }),
    });
  } catch (err) {
    console.error("Failed to revalidate storefront:", err);
  }
}
