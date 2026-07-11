"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";

export function FavoriteButton({ productId }: { productId: string }) {
  const { user } = useAuth();
  const { favoriteIds, toggleFavorite } = useFavorites();
  const router = useRouter();
  const pathname = usePathname();
  const isFavorited = favoriteIds.has(productId);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    toggleFavorite(productId);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isFavorited ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={isFavorited}
      className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur dark:bg-black/70"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 20s-7-4.35-9.5-8.5C.7 8.1 2.3 4.5 6 4.5c2 0 3.4 1.1 4 2.3.6-1.2 2-2.3 4-2.3 3.7 0 5.3 3.6 3.5 7-2.5 4.15-9.5 8.5-9.5 8.5z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill={isFavorited ? "currentColor" : "none"}
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
