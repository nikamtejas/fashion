import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import { Category } from "../src/models/Category";
import { Product } from "../src/models/Product";
import { slugify, seedPricing } from "./seed";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * One-off, non-destructive catalog expansion: brings every MegaMenu
 * sub-category dropdown (Shirts, Sneakers, Dresses, ...) up to 10 products,
 * each carrying one of a handful of real, verified, on-topic stock photos
 * per sub — instead of today's random unrelated placeholder images.
 *
 * - Uploads each curated Unsplash photo to Cloudinary ONCE per sub (5 each)
 *   and reuses that same asset across every product in that sub, rather
 *   than re-uploading per product.
 * - Retrofits existing products in a sub to use the curated images too.
 * - Generates new products (name/材料/color combinations) until the sub
 *   reaches 10 published products.
 * - Never deletes anything.
 */

type CategorySlug = "men" | "women" | "accessories" | "footwear";
type Gender = "MEN" | "WOMEN" | "UNISEX";

interface SubConfig {
  category: CategorySlug;
  gender: Gender;
  nouns: string[];
  materials: string[];
  colors: { name: string; hex: string }[];
  sizes: string[];
  priceMin: number;
  priceMax: number;
  marginMin: number;
  marginMax: number;
  fixedCostMin: number;
  fixedCostMax: number;
  mrpMultMin: number;
  mrpMultMax: number;
  descTemplate: (material: string, noun: string) => string;
}

const ADJECTIVES = [
  "Classic",
  "Modern",
  "Essential",
  "Relaxed",
  "Tailored",
  "Slim-Fit",
  "Everyday",
  "Signature",
  "Heritage",
  "Refined",
  "Considered",
  "Studio",
];

const STOCK_IMAGES: Record<string, string[]> = {
  shirts: [
    "1603252109303-2751441dd157",
    "1621072156002-e2fccdc0b176",
    "1602810318383-e386cc2a3ccf",
    "1602810316693-3667c854239a",
    "1598032895397-b9472444bf93",
  ],
  tshirts: [
    "1581655353564-df123a1eb820",
    "1521572163474-6864f9cf17ab",
    "1562157873-818bc0726f68",
    "1622470953794-aa9c70b0fb9d",
    "1651761179569-4ba2aa054997",
  ],
  trousers: [
    "1584865288642-42078afe6942",
    "1499202977705-65f436dac18a",
    "1781106478353-e94858f39bdd",
    "1781106477932-01d43285d2ff",
    "1698919585873-8c6852de9b96",
  ],
  jackets: [
    "1611312449408-fcece27cdbb7",
    "1537465978529-d23b17165b3b",
    "1543076447-215ad9ba6923",
    "1495105787522-5334e3ffa0ef",
    "1555583743-991174c11425",
  ],
  dresses: [
    "1496747611176-843222e1e57c",
    "1542295669297-4d352b042bca",
    "1532675432006-329c6fed7045",
    "1613966570650-add3cf83aa83",
    "1496217590455-aa63a8350eea",
  ],
  tops: [
    "1620799140408-edc6dcb6d633",
    "1578681994506-b8f463449011",
    "1556905055-8f358a7a47b2",
    "1557303696-f0a415dc1b3e",
    "1582719188393-bb71ca45dbb9",
  ],
  ethnic: [
    "1727835523545-70ee992b5763",
    "1744551358303-46edae8b374b",
    "1622780432053-767528938f34",
    "1655288828238-21d86ec971c3",
    "1727835523550-18478cacefa2",
  ],
  outerwear: [
    "1676716105765-e19fe6a01851",
    "1592327877233-90b9bfd92e48",
    "1633821879282-0c4e91f96232",
    "1619603364904-c0498317e145",
    "1617391258031-f8d80b22fb35",
  ],
  bags: [
    "1574365569389-a10d488ca3fb",
    "1544816155-12df9643f363",
    "1630381260512-e3fe55c11973",
    "1578237493287-8d4d2b03591a",
    "1663573690125-d326a87a2535",
  ],
  belts: [
    "1664286074176-5206ee5dc878",
    "1664285612706-b32633c95820",
    "1666723043169-22e29545675c",
    "1711443982852-b3df5c563448",
    "1637868796504-32f45a96d5a0",
  ],
  jewelry: [
    "1617038220319-276d3cfab638",
    "1633934542430-0905ccb5f050",
    "1602173574767-37ac01994b2a",
    "1616837874254-8d5aaa63e273",
    "1601121141461-9d6647bca1ed",
  ],
  scarves: [
    "1606259458027-54d2a728b6ab",
    "1517472292914-9570a594783b",
    "1677478863154-55ecce8c7536",
    "1551028442-ee84b4d3a50a",
    "1689193502879-362660fad4a8",
  ],
  sneakers: [
    "1600269452121-4f2416e55c28",
    "1512374382149-233c42b6a83b",
    "1626379616459-b2ce1d9decbc",
    "1597350584914-55bb62285896",
    "1562424995-2efe650421dd",
  ],
  formal: [
    "1614252235316-8c857d38b5f4",
    "1668069226492-508742b03147",
    "1531310197839-ccf54634509e",
    "1533867617858-e7b97e060509",
    "1603191659812-ee978eeeef76",
  ],
  sandals: [
    "1603487742131-4160ec999306",
    "1618615098938-84fc29796e76",
    "1562273138-f46be4ebdf33",
    "1585120824848-8a5cd41493d2",
    "1596523027665-9da35ced2388",
  ],
  boots: [
    "1605733160314-4fc7dac4bb16",
    "1605812860427-4024433a70fd",
    "1608256246200-53e635b5b65f",
    "1511283402428-355853756676",
    "1550998358-08b4f83dc345",
  ],
};

const SUB_CONFIG: Record<string, SubConfig> = {
  shirts: {
    category: "men",
    gender: "MEN",
    nouns: ["Oxford Shirt", "Poplin Shirt", "Flannel Shirt", "Linen Shirt", "Chambray Shirt"],
    materials: ["Cotton", "Linen", "Oxford Cotton", "Poplin", "Brushed Flannel"],
    colors: [
      { name: "White", hex: "#F7F5F0" },
      { name: "Sky Blue", hex: "#A9C4D8" },
      { name: "Ink Black", hex: "#141414" },
      { name: "Sienna", hex: "#C15B3C" },
    ],
    sizes: ["S", "M", "L", "XL"],
    priceMin: 550, priceMax: 950, marginMin: 30, marginMax: 38, fixedCostMin: 75, fixedCostMax: 95, mrpMultMin: 2.0, mrpMultMax: 2.6,
    descTemplate: (m, n) => `A ${m.toLowerCase()} ${n.toLowerCase()}, cut for a clean, considered fit — sharp enough for the office, easy enough for the weekend.`,
  },
  tshirts: {
    category: "men",
    gender: "MEN",
    nouns: ["Crew Neck T-Shirt", "V-Neck T-Shirt", "Henley Tee", "Pocket Tee", "Raglan Tee"],
    materials: ["Cotton", "Pima Cotton", "Organic Cotton", "Jersey", "Slub Cotton"],
    colors: [
      { name: "White", hex: "#F7F5F0" },
      { name: "Black", hex: "#1B1B1B" },
      { name: "Charcoal", hex: "#3A3A3A" },
      { name: "Navy", hex: "#2C3E66" },
    ],
    sizes: ["S", "M", "L", "XL"],
    priceMin: 250, priceMax: 450, marginMin: 35, marginMax: 42, fixedCostMin: 45, fixedCostMax: 60, mrpMultMin: 2.5, mrpMultMax: 3.2,
    descTemplate: (m, n) => `A heavyweight ${m.toLowerCase()} ${n.toLowerCase()} that anchors every other layer — the tee you reach for on repeat.`,
  },
  trousers: {
    category: "men",
    gender: "MEN",
    nouns: ["Chinos", "Tailored Trousers", "Cargo Trousers", "Corduroy Trousers", "Pleated Trousers"],
    materials: ["Cotton Twill", "Wool-Blend", "Linen", "Corduroy", "Stretch Cotton"],
    colors: [
      { name: "Charcoal", hex: "#3A3A3A" },
      { name: "Sienna", hex: "#C15B3C" },
      { name: "Navy", hex: "#2C3E66" },
      { name: "Sand", hex: "#D8C3A5" },
    ],
    sizes: ["30", "32", "34", "36"],
    priceMin: 650, priceMax: 980, marginMin: 30, marginMax: 36, fixedCostMin: 80, fixedCostMax: 100, mrpMultMin: 2.2, mrpMultMax: 2.8,
    descTemplate: (m, n) => `Slim-tapered ${n.toLowerCase()} in ${m.toLowerCase()}, finished to move with you through a full day.`,
  },
  jackets: {
    category: "men",
    gender: "MEN",
    nouns: ["Bomber Jacket", "Denim Jacket", "Field Jacket", "Harrington Jacket", "Overshirt Jacket"],
    materials: ["Denim", "Cotton Twill", "Quilted Nylon", "Corduroy", "Waxed Cotton"],
    colors: [
      { name: "Olive", hex: "#6B705C" },
      { name: "Black", hex: "#1B1B1B" },
      { name: "Navy", hex: "#2C3E66" },
      { name: "Tan", hex: "#B08463" },
    ],
    sizes: ["S", "M", "L", "XL"],
    priceMin: 900, priceMax: 1500, marginMin: 30, marginMax: 36, fixedCostMin: 90, fixedCostMax: 120, mrpMultMin: 2.4, mrpMultMax: 3.0,
    descTemplate: (m, n) => `A ${m.toLowerCase()} ${n.toLowerCase()} built for layering — the piece that finishes everything underneath it.`,
  },
  dresses: {
    category: "women",
    gender: "WOMEN",
    nouns: ["Wrap Dress", "Slip Dress", "Shirt Dress", "A-Line Dress", "Maxi Dress"],
    materials: ["Silk", "Cotton", "Linen", "Crepe", "Satin"],
    colors: [
      { name: "Ivory", hex: "#FAF7F2" },
      { name: "Sienna", hex: "#C15B3C" },
      { name: "Emerald", hex: "#2F5D50" },
      { name: "Terracotta", hex: "#B5583C" },
    ],
    sizes: ["XS", "S", "M", "L"],
    priceMin: 700, priceMax: 1700, marginMin: 32, marginMax: 40, fixedCostMin: 85, fixedCostMax: 115, mrpMultMin: 2.4, mrpMultMax: 3.2,
    descTemplate: (m, n) => `A ${m.toLowerCase()} ${n.toLowerCase()} that skims the body without clinging — dress it up or down.`,
  },
  tops: {
    category: "women",
    gender: "WOMEN",
    nouns: ["Cami Top", "Blouse", "Knit Top", "Wrap Top", "Peplum Top"],
    materials: ["Ribbed Knit", "Cotton", "Satin", "Linen", "Merino"],
    colors: [
      { name: "Sage", hex: "#8A9A7E" },
      { name: "Ivory", hex: "#FAF7F2" },
      { name: "Black", hex: "#1B1B1B" },
      { name: "Navy", hex: "#2C3E66" },
    ],
    sizes: ["XS", "S", "M", "L"],
    priceMin: 350, priceMax: 580, marginMin: 34, marginMax: 40, fixedCostMin: 60, fixedCostMax: 80, mrpMultMin: 2.6, mrpMultMax: 3.2,
    descTemplate: (m, n) => `A close-fit ${m.toLowerCase()} ${n.toLowerCase()}, cut long enough to tuck or wear loose over trousers and skirts alike.`,
  },
  ethnic: {
    category: "women",
    gender: "WOMEN",
    nouns: ["Kurta Set", "Anarkali Suit", "Palazzo Set", "Saree", "Kurta Pajama Set"],
    materials: ["Hand-Embroidered", "Chanderi Silk", "Cotton", "Banarasi", "Block-Print"],
    colors: [
      { name: "Sienna", hex: "#C15B3C" },
      { name: "Emerald", hex: "#2F5D50" },
      { name: "Terracotta", hex: "#B5583C" },
      { name: "Gold", hex: "#C9A24B" },
    ],
    sizes: ["S", "M", "L", "XL"],
    priceMin: 900, priceMax: 1700, marginMin: 34, marginMax: 40, fixedCostMin: 100, fixedCostMax: 130, mrpMultMin: 2.6, mrpMultMax: 3.2,
    descTemplate: (m, n) => `A ${m.toLowerCase()} ${n.toLowerCase()}, finished for festive occasions and considered enough to wear well beyond them.`,
  },
  outerwear: {
    category: "women",
    gender: "WOMEN",
    nouns: ["Trench Coat", "Wool Coat", "Cape Coat", "Blazer Coat", "Puffer Jacket"],
    materials: ["Wool-Blend", "Cotton Twill", "Water-Resistant Cotton", "Brushed Wool", "Quilted Nylon"],
    colors: [
      { name: "Camel", hex: "#C19A6B" },
      { name: "Black", hex: "#1B1B1B" },
      { name: "Charcoal", hex: "#3A3A3A" },
      { name: "Navy", hex: "#2C3E66" },
    ],
    sizes: ["XS", "S", "M", "L"],
    priceMin: 900, priceMax: 2100, marginMin: 28, marginMax: 36, fixedCostMin: 100, fixedCostMax: 150, mrpMultMin: 2.4, mrpMultMax: 3.0,
    descTemplate: (m, n) => `A ${m.toLowerCase()} ${n.toLowerCase()} cut with a nipped waist — the layer that survives real weather.`,
  },
  bags: {
    category: "accessories",
    gender: "WOMEN",
    nouns: ["Tote Bag", "Crossbody Bag", "Backpack", "Clutch", "Sling Bag"],
    materials: ["Full-Grain Leather", "Saffiano Leather", "Canvas", "Vegetable-Tanned Leather", "Suede"],
    colors: [
      { name: "Tan", hex: "#B08463" },
      { name: "Black", hex: "#1B1B1B" },
      { name: "Brown", hex: "#5C3A21" },
      { name: "Ivory", hex: "#FAF7F2" },
    ],
    sizes: ["One Size"],
    priceMin: 700, priceMax: 2200, marginMin: 36, marginMax: 42, fixedCostMin: 90, fixedCostMax: 130, mrpMultMin: 2.6, mrpMultMax: 3.4,
    descTemplate: (m, n) => `A ${m.toLowerCase()} ${n.toLowerCase()} with a structured base and interior pocket — built to age well, not fall apart.`,
  },
  belts: {
    category: "accessories",
    gender: "UNISEX",
    nouns: ["Leather Belt", "Woven Belt", "Reversible Belt", "Suede Belt", "Braided Belt"],
    materials: ["Full-Grain Leather", "Woven Leather", "Suede", "Reversible Leather", "Braided Leather"],
    colors: [
      { name: "Black", hex: "#1B1B1B" },
      { name: "Brown", hex: "#5C3A21" },
      { name: "Tan", hex: "#B08463" },
    ],
    sizes: ["S", "M", "L"],
    priceMin: 350, priceMax: 500, marginMin: 36, marginMax: 40, fixedCostMin: 50, fixedCostMax: 65, mrpMultMin: 2.6, mrpMultMax: 3.2,
    descTemplate: (m, n) => `A ${m.toLowerCase()} ${n.toLowerCase()} with a matte buckle — the kind that outlasts the trousers it holds up.`,
  },
  jewelry: {
    category: "accessories",
    gender: "WOMEN",
    nouns: ["Necklace", "Hoop Earrings", "Bracelet", "Ring Set", "Anklet"],
    materials: ["Gold-Plated", "14k Gold-Plated", "Brass", "Gold-Vermeil", "Freshwater Pearl"],
    colors: [{ name: "Gold", hex: "#C9A24B" }],
    sizes: ["One Size"],
    priceMin: 200, priceMax: 400, marginMin: 42, marginMax: 46, fixedCostMin: 35, fixedCostMax: 50, mrpMultMin: 3.0, mrpMultMax: 3.8,
    descTemplate: (m, n) => `A ${m.toLowerCase()} ${n.toLowerCase()}, lightweight enough for everyday wear and finished by hand.`,
  },
  scarves: {
    category: "accessories",
    gender: "UNISEX",
    nouns: ["Silk Scarf", "Wool Scarf", "Printed Stole", "Cotton Wrap", "Cashmere Scarf"],
    materials: ["Silk Twill", "Merino Wool", "Cashmere-Blend", "Cotton Voile", "Modal"],
    colors: [
      { name: "Charcoal", hex: "#3A3A3A" },
      { name: "Camel", hex: "#C19A6B" },
      { name: "Sage", hex: "#8A9A7E" },
      { name: "Terracotta", hex: "#B5583C" },
    ],
    sizes: ["One Size"],
    priceMin: 300, priceMax: 460, marginMin: 38, marginMax: 44, fixedCostMin: 45, fixedCostMax: 65, mrpMultMin: 2.8, mrpMultMax: 3.4,
    descTemplate: (m, n) => `A ${m.toLowerCase()} ${n.toLowerCase()}, generously sized and hand-finished at the edges.`,
  },
  sneakers: {
    category: "footwear",
    gender: "UNISEX",
    nouns: ["Low-Top Sneakers", "High-Top Sneakers", "Running Sneakers", "Canvas Sneakers", "Knit Sneakers"],
    materials: ["Leather", "Canvas", "Suede", "Recycled Knit", "Nubuck"],
    colors: [
      { name: "White", hex: "#F7F5F0" },
      { name: "Black", hex: "#1B1B1B" },
      { name: "Navy", hex: "#2C3E66" },
      { name: "Sand", hex: "#D8C3A5" },
    ],
    sizes: ["6", "7", "8", "9", "10", "11"],
    priceMin: 750, priceMax: 1500, marginMin: 32, marginMax: 38, fixedCostMin: 80, fixedCostMax: 115, mrpMultMin: 2.4, mrpMultMax: 3.0,
    descTemplate: (m, n) => `Clean-lined ${n.toLowerCase()} in ${m.toLowerCase()} on a cupsole — built to go from studio to dinner without changing.`,
  },
  formal: {
    category: "footwear",
    gender: "MEN",
    nouns: ["Oxfords", "Derby Shoes", "Loafers", "Monk Strap Shoes", "Brogues"],
    materials: ["Calfskin Leather", "Patent Leather", "Suede", "Full-Grain Leather", "Burnished Leather"],
    colors: [
      { name: "Black", hex: "#1B1B1B" },
      { name: "Brown", hex: "#5C3A21" },
      { name: "Tan", hex: "#B08463" },
    ],
    sizes: ["6", "7", "8", "9", "10", "11"],
    priceMin: 1600, priceMax: 2200, marginMin: 28, marginMax: 34, fixedCostMin: 110, fixedCostMax: 135, mrpMultMin: 2.4, mrpMultMax: 2.9,
    descTemplate: (m, n) => `Hand-finished ${n.toLowerCase()} in ${m.toLowerCase()}, Goodyear-welted for a sole that can be replaced, not the shoe.`,
  },
  sandals: {
    category: "footwear",
    gender: "WOMEN",
    nouns: ["Strappy Sandals", "Block Heel Sandals", "Flat Sandals", "Slide Sandals", "Wedge Sandals"],
    materials: ["Nappa Leather", "Woven Leather", "Suede", "Vegetable-Tanned Leather", "Patent Leather"],
    colors: [
      { name: "Tan", hex: "#B08463" },
      { name: "Black", hex: "#1B1B1B" },
      { name: "Sand", hex: "#D8C3A5" },
    ],
    sizes: ["4", "5", "6", "7", "8"],
    priceMin: 500, priceMax: 1050, marginMin: 34, marginMax: 40, fixedCostMin: 65, fixedCostMax: 95, mrpMultMin: 2.6, mrpMultMax: 3.2,
    descTemplate: (m, n) => `${n} in soft ${m.toLowerCase()}, built for a full day on your feet without giving up on style.`,
  },
  boots: {
    category: "footwear",
    gender: "UNISEX",
    nouns: ["Chelsea Boots", "Ankle Boots", "Combat Boots", "Desert Boots", "Knee-High Boots"],
    materials: ["Suede", "Full-Grain Leather", "Waxed Leather", "Nubuck", "Waterproof Leather"],
    colors: [
      { name: "Black", hex: "#1B1B1B" },
      { name: "Tan", hex: "#B08463" },
      { name: "Brown", hex: "#5C3A21" },
    ],
    sizes: ["6", "7", "8", "9", "10", "11"],
    priceMin: 1400, priceMax: 2050, marginMin: 30, marginMax: 36, fixedCostMin: 100, fixedCostMax: 130, mrpMultMin: 2.4, mrpMultMax: 2.9,
    descTemplate: (m, n) => `${n} in ${m.toLowerCase()} with a stacked heel — the boot that quietly goes with everything.`,
  },
};

const TARGET_PER_SUB = 10;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

async function uploadStockImage(photoId: string, sub: string, index: number) {
  const remoteUrl = `https://images.unsplash.com/photo-${photoId}?w=1000&q=80&fit=crop`;
  const result = await cloudinary.uploader.upload(remoteUrl, {
    folder: `luxeloom/products/_stock/${sub}`,
    public_id: `${sub}-${index}`,
    overwrite: true,
  });
  return { publicId: result.public_id, secureUrl: result.secure_url };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set.");
  await mongoose.connect(uri);

  const categoryDocs = await Category.find({}).lean();
  const categoryBySlug = new Map(categoryDocs.map((c) => [c.slug, c._id]));

  const allExistingProducts = await Product.find({}).select("name").lean();
  const usedNames = new Set(allExistingProducts.map((p) => p.name));

  for (const [sub, config] of Object.entries(SUB_CONFIG)) {
    console.log(`\n=== ${sub} ===`);
    const photoIds = STOCK_IMAGES[sub];

    // Upload (or reuse) the 5 curated stock images for this sub once.
    const uploaded = await Promise.all(photoIds.map((id, i) => uploadStockImage(id, sub, i)));

    const categoryId = categoryBySlug.get(config.category);
    if (!categoryId) throw new Error(`Category ${config.category} not found — run npm run seed first.`);

    // Retrofit existing products already tagged with this sub to use the
    // curated on-topic images instead of their random placeholder photos.
    // Scoped to the sub's own category too — some descriptive tags (e.g.
    // "formal", "trousers") double as plain adjectives on products in other
    // categories, which must not get this sub's images.
    const existing = await Product.find({ tags: sub, category: categoryId }).select("_id name images");
    for (let i = 0; i < existing.length; i++) {
      const doc = existing[i];
      const front = uploaded[i % uploaded.length];
      const back = uploaded[(i + 2) % uploaded.length];
      doc.images = [
        { publicId: front.publicId, secureUrl: front.secureUrl, type: "ORIGINAL", order: 0, altText: `${doc.name} — front` },
        { publicId: back.publicId, secureUrl: back.secureUrl, type: "ORIGINAL", order: 1, altText: `${doc.name} — back` },
      ] as (typeof doc.images);
      await doc.save();
      console.log(`  ~ retrofit images: ${doc.name}`);
    }

    const needed = Math.max(0, TARGET_PER_SUB - existing.length);
    for (let i = 0; i < needed; i++) {
      const adjective = ADJECTIVES[i % ADJECTIVES.length];
      const material = config.materials[i % config.materials.length];
      const noun = config.nouns[i % config.nouns.length];
      let name = `${adjective} ${material} ${noun}`;
      let bump = 0;
      while (usedNames.has(name)) {
        bump++;
        name = `${adjective} ${config.materials[(i + bump) % config.materials.length]} ${noun}`;
        if (bump > config.materials.length) break;
      }
      usedNames.add(name);

      const slug = slugify(name);
      if (await Product.findOne({ slug }).select("_id").lean()) continue; // already present, skip

      const colorA = config.colors[i % config.colors.length];
      const colorB = config.colors[(i + 1) % config.colors.length];
      const colors = colorA.name === colorB.name ? [colorA] : [colorA, colorB];

      const variants = config.sizes.flatMap((size) =>
        colors.map((color) => ({
          size,
          color: color.name,
          colorHex: color.hex,
          sku: `${slug}-${size}-${slugify(color.name)}`.toUpperCase(),
          stock: 5 + Math.floor(Math.random() * 20),
        }))
      );

      const purchasePrice = Math.round(rand(config.priceMin, config.priceMax));
      const marginPct = Math.round(rand(config.marginMin, config.marginMax) * 10) / 10;
      const fixedCost = Math.round(rand(config.fixedCostMin, config.fixedCostMax));
      const mrp = Math.round((purchasePrice * rand(config.mrpMultMin, config.mrpMultMax)) / 10) * 10 - 1;

      const front = uploaded[i % uploaded.length];
      const back = uploaded[(i + 2) % uploaded.length];

      await Product.create({
        name,
        slug,
        description: config.descTemplate(material, noun),
        category: categoryId,
        gender: config.gender,
        tags: [sub, material.toLowerCase(), noun.toLowerCase()],
        variants,
        images: [
          { publicId: front.publicId, secureUrl: front.secureUrl, type: "ORIGINAL", order: 0, altText: `${name} — front` },
          { publicId: back.publicId, secureUrl: back.secureUrl, type: "ORIGINAL", order: 1, altText: `${name} — back` },
        ],
        pricing: seedPricing({ purchasePrice, marginPct, fixedCost, mrp }),
        status: "PUBLISHED",
      });
      console.log(`  + ${name}`);
    }
  }

  console.log("\n--- Final sub-category counts ---");
  for (const sub of Object.keys(SUB_CONFIG)) {
    const count = await Product.countDocuments({ tags: sub, status: "PUBLISHED" });
    console.log(`${sub}: ${count}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
