import { apiFetch } from "./api";
import type { Product } from "./products";

export function listFavorites() {
  return apiFetch<{ items: Product[] }>("/api/favorites");
}

export function addFavorite(productId: string) {
  return apiFetch<{ favorited: boolean }>("/api/favorites", {
    method: "POST",
    body: JSON.stringify({ productId }),
  });
}

export function removeFavorite(productId: string) {
  return apiFetch<void>(`/api/favorites/${productId}`, { method: "DELETE" });
}
