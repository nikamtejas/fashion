import { Router } from "express";
import { Product } from "../models/Product";
import { cloudinaryUrl } from "../lib/cloudinary";

const router = Router();

// ─── Typo-tolerant scoring ──────────────────────────────────────────────────
// Trigram overlap + prefix/substring boosts over name+tags. The catalog is
// small enough to score in memory; at real scale this becomes an Atlas
// Search index — the endpoint contract wouldn't change.

function trigrams(s: string): Set<string> {
  const padded = `  ${s.toLowerCase()} `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3));
  return grams;
}

function similarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  let overlap = 0;
  for (const g of ta) if (tb.has(g)) overlap++;
  return overlap / Math.max(ta.size, tb.size, 1);
}

function scoreProduct(query: string, name: string, tags: string[]): number {
  const q = query.toLowerCase().trim();
  const n = name.toLowerCase();
  let score = similarity(q, n);
  // Word-level: best fuzzy match against individual words catches
  // single-word typos ("snekers" → "sneakers").
  for (const word of [...n.split(/\s+/), ...tags.map((t) => t.toLowerCase())]) {
    score = Math.max(score, similarity(q, word) * 0.95);
    if (word.startsWith(q)) score = Math.max(score, 0.9);
  }
  if (n.includes(q)) score = Math.max(score, 1);
  return score;
}

router.get("/suggest", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) return res.json({ results: [] });

  const products = await Product.find({ status: "PUBLISHED" })
    .select("name slug tags images pricing.finalPrice")
    .lean();

  const scored = products
    .map((p) => ({ p, score: scoreProduct(q, p.name, p.tags ?? []) }))
    .filter((x) => x.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  res.json({
    results: scored.map(({ p }) => ({
      name: p.name,
      slug: p.slug,
      price: p.pricing?.finalPrice ?? 0,
      image: p.images?.[0]?.publicId ? cloudinaryUrl(p.images[0].publicId, 100) : null,
    })),
  });
});

export default router;
