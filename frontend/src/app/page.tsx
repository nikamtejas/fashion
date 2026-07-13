import { API_URL } from "@/lib/api";
import { Hero } from "@/components/landing/Hero";
import { NewDrops, type NewDropProduct } from "@/components/landing/NewDrops";
import { CategoryTiles } from "@/components/landing/CategoryTiles";
import { BrandStory } from "@/components/landing/BrandStory";
import { LookbookGrid } from "@/components/landing/LookbookGrid";

async function getNewDrops(): Promise<NewDropProduct[]> {
  try {
    // Stock/price enforcement happens server-side at checkout regardless —
    // a 30s-stale "in stock" badge here costs nothing but avoids a live
    // round trip to the API on every single home page visit.
    const res = await fetch(`${API_URL}/api/products?sort=new&limit=10`, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.products ?? [];
  } catch {
    // Backend not reachable (e.g. not started yet) — landing page still renders.
    return [];
  }
}

export default async function HomePage() {
  const newDrops = await getNewDrops();

  return (
    <>
      <Hero />
      <NewDrops products={newDrops} />
      <CategoryTiles />
      <BrandStory />
      <LookbookGrid />
    </>
  );
}
