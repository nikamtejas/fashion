import mongoose from "mongoose";
import { Category } from "../src/models/Category";
import { Product } from "../src/models/Product";
import { CATEGORIES, PRODUCTS, slugify, seedPricing, uploadPlaceholder } from "./seed";

/**
 * One-off, non-destructive sync: brings the live dev DB's catalog in line
 * with the PRODUCTS list in seed.ts without deleting or resetting anything.
 * - Inserts any product from PRODUCTS that isn't in the DB yet (by slug).
 * - Adds (never removes) the correct sub-category tag to existing products
 *   whose tags in PRODUCTS have grown since they were first seeded.
 * - Fixes the two known-broken auto-generated products ("TShirt",
 *   "Professional branding") whose tags/description leaked a raw category
 *   ObjectId instead of the category name.
 */
async function sync() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set.");
  await mongoose.connect(uri);

  const categoryDocs = await Category.find({ slug: { $in: CATEGORIES.map((c) => c.slug) } }).lean();
  const categoryBySlug = new Map(categoryDocs.map((c) => [c.slug, c._id]));
  const categoryNameBySlug = new Map(CATEGORIES.map((c) => [c.slug, c.name]));
  if (categoryBySlug.size !== CATEGORIES.length) {
    throw new Error("Expected categories (men/women/accessories/footwear) not found — run `npm run seed` first.");
  }

  let inserted = 0;
  let patched = 0;

  for (const p of PRODUCTS) {
    const slug = slugify(p.name);
    const existing = await Product.findOne({ slug });

    if (!existing) {
      const folder = `luxeloom/products/${slug}`;
      const [front, back] = await Promise.all([
        uploadPlaceholder(`${p.imageSeed}-front`, folder, "original-front"),
        uploadPlaceholder(`${p.imageSeed}-back`, folder, "original-back"),
      ]);
      const variants = p.sizes.flatMap((size) =>
        p.colors.map((color) => ({
          size,
          color: color.name,
          colorHex: color.hex,
          sku: `${slug}-${size}-${slugify(color.name)}`.toUpperCase(),
          stock: 5 + Math.floor(Math.random() * 20),
        }))
      );
      await Product.create({
        name: p.name,
        slug,
        description: p.description,
        category: categoryBySlug.get(p.category),
        gender: p.gender,
        tags: p.tags,
        variants,
        images: [
          { publicId: front.publicId, secureUrl: front.secureUrl, type: "ORIGINAL", order: 0, altText: `${p.name} — front` },
          { publicId: back.publicId, secureUrl: back.secureUrl, type: "ORIGINAL", order: 1, altText: `${p.name} — back` },
        ],
        pricing: seedPricing({ purchasePrice: p.purchasePrice, marginPct: p.marginPct, fixedCost: p.fixedCost, mrp: p.mrp }),
        status: "PUBLISHED",
      });
      inserted++;
      console.log(`  + inserted ${p.name}`);
    } else {
      const missingTags = p.tags.filter((t) => !existing.tags.includes(t));
      if (missingTags.length > 0) {
        await Product.updateOne({ _id: existing._id }, { $addToSet: { tags: { $each: missingTags } } });
        patched++;
        console.log(`  ~ patched tags on ${p.name}: +${missingTags.join(",")}`);
      }
    }
  }

  // Fix the two auto-generated products whose tags/description leaked a raw
  // category ObjectId (a template variable that never resolved to the name).
  const fixups: { name: string; sub: string }[] = [
    { name: "TShirt", sub: "tshirts" },
    { name: "Professional branding", sub: "tops" },
  ];
  for (const fix of fixups) {
    const doc = await Product.findOne({ name: fix.name });
    if (!doc) continue;
    const categorySlug = CATEGORIES.find((c) => String(categoryBySlug.get(c.slug)) === String(doc.category))?.slug;
    const categoryName = categorySlug ? categoryNameBySlug.get(categorySlug) : undefined;
    const cleanTags = doc.tags.filter((t) => !mongoose.isValidObjectId(t));
    if (!cleanTags.includes(fix.sub)) cleanTags.push(fix.sub);

    const update: Record<string, unknown> = { tags: cleanTags };
    if (categoryName && doc.description.includes(String(doc.category))) {
      update.description = doc.description.replaceAll(String(doc.category), categoryName);
    }
    await Product.updateOne({ _id: doc._id }, { $set: update });
    patched++;
    console.log(`  ~ fixed ${fix.name}: tags=${cleanTags.join(",")}`);
  }

  console.log(`\nDone. Inserted ${inserted}, patched ${patched}.`);

  for (const c of CATEGORIES) {
    const count = await Product.countDocuments({ category: categoryBySlug.get(c.slug), status: "PUBLISHED" });
    console.log(`${c.name}: ${count} published products`);
  }

  await mongoose.disconnect();
}

sync().catch((err) => {
  console.error(err);
  process.exit(1);
});
