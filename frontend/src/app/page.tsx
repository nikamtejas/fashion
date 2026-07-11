import { API_URL } from "@/lib/api";
import { Hero } from "@/components/landing/Hero";
import { NewDrops, type NewDropProduct } from "@/components/landing/NewDrops";
import { CategoryTiles } from "@/components/landing/CategoryTiles";
import { BrandStory } from "@/components/landing/BrandStory";
import { LookbookGrid } from "@/components/landing/LookbookGrid";

// Live catalog data (stock, pricing) — never statically prerendered.
export const dynamic = "force-dynamic";

async function getNewDrops(): Promise<NewDropProduct[]> {
  try {
    const res = await fetch(`${API_URL}/api/products?sort=new&limit=10`, { cache: "no-store" });
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
