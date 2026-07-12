import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import { Category } from "../src/models/Category";
import { Product } from "../src/models/Product";
import { StoreLocation } from "../src/models/StoreLocation";
import { computePricing } from "../src/lib/pricing";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Pricing comes from the real M3 engine so seeded products carry the same
// full breakdown shape the admin wizard produces.
function seedPricing({
  purchasePrice,
  marginPct,
  fixedCost,
  mrp,
}: {
  purchasePrice: number;
  marginPct: number;
  fixedCost: number;
  mrp?: number;
}) {
  return computePricing({
    purchasePrice,
    marginType: "PERCENTAGE",
    marginValue: marginPct,
    fixedCosts: [{ name: "Packaging & Logistics", value: fixedCost }],
    mrp,
  });
}

interface SeedProduct {
  name: string;
  category: "men" | "women" | "accessories" | "footwear";
  gender: "MEN" | "WOMEN" | "UNISEX";
  description: string;
  tags: string[];
  sizes: string[];
  colors: { name: string; hex: string }[];
  purchasePrice: number;
  marginPct: number;
  fixedCost: number;
  mrp?: number;
  imageSeed: string;
}

const CATEGORIES: { name: string; slug: SeedProduct["category"] }[] = [
  { name: "Men", slug: "men" },
  { name: "Women", slug: "women" },
  { name: "Accessories", slug: "accessories" },
  { name: "Footwear", slug: "footwear" },
];

const PRODUCTS: SeedProduct[] = [
  // MEN
  {
    name: "Ink Black Oxford Shirt",
    category: "men",
    gender: "MEN",
    description:
      "A tailored Oxford shirt in ink black, cut from breathable cotton with a clean spread collar. Wear it buttoned up for the office or open over a tee on weekends.",
    tags: ["shirt", "formal", "cotton", "office"],
    sizes: ["S", "M", "L", "XL"],
    colors: [{ name: "Ink Black", hex: "#141414" }, { name: "White", hex: "#F7F5F0" }],
    purchasePrice: 650,
    marginPct: 35,
    fixedCost: 80,
    mrp: 1799,
    imageSeed: "oxford-shirt",
  },
  {
    name: "Sienna Chino Trousers",
    category: "men",
    gender: "MEN",
    description:
      "Slim-tapered chinos in a warm sienna tone, finished with a mechanical stretch weave that moves with you through a full day.",
    tags: ["trousers", "chino", "casual"],
    sizes: ["30", "32", "34", "36"],
    colors: [{ name: "Sienna", hex: "#C15B3C" }, { name: "Charcoal", hex: "#3A3A3A" }],
    purchasePrice: 720,
    marginPct: 32,
    fixedCost: 90,
    mrp: 2199,
    imageSeed: "chino-trousers",
  },
  {
    name: "Merino Wool Crewneck Sweater",
    category: "men",
    gender: "MEN",
    description:
      "A fine-gauge merino crewneck that regulates temperature naturally — light enough for layering, warm enough to wear alone.",
    tags: ["sweater", "wool", "winter"],
    sizes: ["S", "M", "L", "XL"],
    colors: [{ name: "Charcoal", hex: "#3A3A3A" }, { name: "Ivory", hex: "#FAF7F2" }],
    purchasePrice: 1400,
    marginPct: 30,
    fixedCost: 100,
    mrp: 3999,
    imageSeed: "merino-sweater",
  },
  {
    name: "Linen Blend Overshirt",
    category: "men",
    gender: "MEN",
    description:
      "An unstructured overshirt in a linen-cotton blend, built to be thrown over anything and worn open like a light jacket.",
    tags: ["overshirt", "linen", "layering"],
    sizes: ["S", "M", "L", "XL"],
    colors: [{ name: "Olive", hex: "#6B705C" }, { name: "Sand", hex: "#D8C3A5" }],
    purchasePrice: 890,
    marginPct: 34,
    fixedCost: 95,
    mrp: 2599,
    imageSeed: "linen-overshirt",
  },
  {
    name: "Tapered Denim Jeans",
    category: "men",
    gender: "MEN",
    description:
      "Rigid-to-soften Japanese-inspired denim in a tapered fit, garment-washed for a broken-in feel from day one.",
    tags: ["denim", "jeans", "casual"],
    sizes: ["30", "32", "34", "36"],
    colors: [{ name: "Indigo", hex: "#2C3E66" }, { name: "Black", hex: "#1B1B1B" }],
    purchasePrice: 980,
    marginPct: 33,
    fixedCost: 100,
    mrp: 2999,
    imageSeed: "denim-jeans",
  },
  // WOMEN
  {
    name: "Silk Slip Midi Dress",
    category: "women",
    gender: "WOMEN",
    description:
      "A bias-cut silk slip dress that skims the body without clinging, finished with delicate adjustable straps.",
    tags: ["dress", "silk", "evening"],
    sizes: ["XS", "S", "M", "L"],
    colors: [{ name: "Ivory", hex: "#FAF7F2" }, { name: "Sienna", hex: "#C15B3C" }],
    purchasePrice: 1600,
    marginPct: 38,
    fixedCost: 110,
    mrp: 4999,
    imageSeed: "silk-slip-dress",
  },
  {
    name: "Wide Leg Linen Trousers",
    category: "women",
    gender: "WOMEN",
    description:
      "High-waisted, wide-leg trousers in washed linen — the kind of trousers you reach for on the hottest days of the year.",
    tags: ["trousers", "linen", "summer"],
    sizes: ["XS", "S", "M", "L"],
    colors: [{ name: "Sand", hex: "#D8C3A5" }, { name: "Black", hex: "#1B1B1B" }],
    purchasePrice: 780,
    marginPct: 33,
    fixedCost: 90,
    mrp: 2399,
    imageSeed: "wide-leg-trousers",
  },
  {
    name: "Ribbed Knit Top",
    category: "women",
    gender: "WOMEN",
    description:
      "A close-fit ribbed knit top with a soft sheen, cut long enough to tuck or wear loose over trousers and skirts alike.",
    tags: ["top", "knitwear", "everyday"],
    sizes: ["XS", "S", "M", "L"],
    colors: [{ name: "Sage", hex: "#8A9A7E" }, { name: "Ivory", hex: "#FAF7F2" }],
    purchasePrice: 480,
    marginPct: 36,
    fixedCost: 70,
    mrp: 1499,
    imageSeed: "ribbed-knit-top",
  },
  {
    name: "Tailored Trench Coat",
    category: "women",
    gender: "WOMEN",
    description:
      "A double-breasted trench in water-resistant cotton twill, cut with a nipped waist and storm flap for real weather.",
    tags: ["coat", "outerwear", "trench"],
    sizes: ["XS", "S", "M", "L"],
    colors: [{ name: "Camel", hex: "#C19A6B" }, { name: "Black", hex: "#1B1B1B" }],
    purchasePrice: 2400,
    marginPct: 28,
    fixedCost: 150,
    mrp: 6999,
    imageSeed: "trench-coat",
  },
  {
    name: "Pleated Midi Skirt",
    category: "women",
    gender: "WOMEN",
    description:
      "Fine knife pleats catch the light with every step — a midi skirt that moves as much as it flatters.",
    tags: ["skirt", "pleated", "office"],
    sizes: ["XS", "S", "M", "L"],
    colors: [{ name: "Charcoal", hex: "#3A3A3A" }, { name: "Terracotta", hex: "#B5583C" }],
    purchasePrice: 820,
    marginPct: 34,
    fixedCost: 85,
    mrp: 2599,
    imageSeed: "pleated-skirt",
  },
  // ACCESSORIES
  {
    name: "Leather Tote Bag",
    category: "accessories",
    gender: "UNISEX",
    description:
      "Full-grain leather tote with a structured base and interior zip pocket — built to age well, not fall apart.",
    tags: ["bag", "leather", "tote"],
    sizes: ["One Size"],
    colors: [{ name: "Tan", hex: "#B08463" }, { name: "Black", hex: "#1B1B1B" }],
    purchasePrice: 1900,
    marginPct: 40,
    fixedCost: 120,
    mrp: 5999,
    imageSeed: "leather-tote",
  },
  {
    name: "Woven Leather Belt",
    category: "accessories",
    gender: "UNISEX",
    description: "A hand-woven leather belt with a matte brass buckle — the kind that outlasts the trousers it holds up.",
    tags: ["belt", "leather"],
    sizes: ["S", "M", "L"],
    colors: [{ name: "Brown", hex: "#5C3A21" }, { name: "Black", hex: "#1B1B1B" }],
    purchasePrice: 420,
    marginPct: 38,
    fixedCost: 60,
    mrp: 1299,
    imageSeed: "woven-belt",
  },
  {
    name: "Printed Silk Scarf",
    category: "accessories",
    gender: "UNISEX",
    description: "A 90cm silk twill scarf, hand-rolled at the edges, printed in a limited seasonal motif.",
    tags: ["scarf", "silk", "print"],
    sizes: ["One Size"],
    colors: [{ name: "Sienna Print", hex: "#C15B3C" }, { name: "Sage Print", hex: "#8A9A7E" }],
    purchasePrice: 380,
    marginPct: 42,
    fixedCost: 55,
    mrp: 1199,
    imageSeed: "silk-scarf",
  },
  {
    name: "Gold-Plated Hoop Earrings",
    category: "accessories",
    gender: "WOMEN",
    description: "14k gold-plated brass hoops, lightweight enough for everyday wear and finished by hand.",
    tags: ["jewelry", "earrings", "gold"],
    sizes: ["One Size"],
    colors: [{ name: "Gold", hex: "#C9A24B" }],
    purchasePrice: 240,
    marginPct: 45,
    fixedCost: 40,
    mrp: 899,
    imageSeed: "hoop-earrings",
  },
  {
    name: "Structured Crossbody Bag",
    category: "accessories",
    gender: "WOMEN",
    description: "A compact structured crossbody in saffiano-textured leather, sized for the essentials only.",
    tags: ["bag", "crossbody", "leather"],
    sizes: ["One Size"],
    colors: [{ name: "Ivory", hex: "#FAF7F2" }, { name: "Black", hex: "#1B1B1B" }],
    purchasePrice: 1100,
    marginPct: 39,
    fixedCost: 95,
    mrp: 3499,
    imageSeed: "crossbody-bag",
  },
  // FOOTWEAR
  {
    name: "Minimalist Leather Sneakers",
    category: "footwear",
    gender: "UNISEX",
    description: "Clean-lined leather sneakers on a cupsole, designed to go from the studio to dinner without changing.",
    tags: ["sneakers", "leather", "casual"],
    sizes: ["6", "7", "8", "9", "10", "11"],
    colors: [{ name: "White", hex: "#F7F5F0" }, { name: "Black", hex: "#1B1B1B" }],
    purchasePrice: 1350,
    marginPct: 34,
    fixedCost: 110,
    mrp: 3999,
    imageSeed: "leather-sneakers",
  },
  {
    name: "Suede Chelsea Boots",
    category: "footwear",
    gender: "UNISEX",
    description: "Classic Chelsea boots in brushed suede with elastic side panels and a stacked leather heel.",
    tags: ["boots", "suede", "chelsea"],
    sizes: ["6", "7", "8", "9", "10", "11"],
    colors: [{ name: "Tan", hex: "#B08463" }, { name: "Black", hex: "#1B1B1B" }],
    purchasePrice: 1700,
    marginPct: 32,
    fixedCost: 120,
    mrp: 4999,
    imageSeed: "chelsea-boots",
  },
  {
    name: "Block Heel Sandals",
    category: "footwear",
    gender: "WOMEN",
    description: "A comfortable block heel in soft nappa leather, built for a full day on your feet.",
    tags: ["sandals", "heels", "leather"],
    sizes: ["4", "5", "6", "7", "8"],
    colors: [{ name: "Nude", hex: "#D8B79A" }, { name: "Black", hex: "#1B1B1B" }],
    purchasePrice: 950,
    marginPct: 36,
    fixedCost: 95,
    mrp: 2999,
    imageSeed: "block-heel-sandals",
  },
  {
    name: "Canvas Espadrilles",
    category: "footwear",
    gender: "UNISEX",
    description: "Lightweight canvas espadrilles with a natural jute wrap sole — warm-weather footwear, done simply.",
    tags: ["espadrilles", "canvas", "summer"],
    sizes: ["4", "5", "6", "7", "8"],
    colors: [{ name: "Natural", hex: "#E4D9C4" }, { name: "Navy", hex: "#2C3E66" }],
    purchasePrice: 420,
    marginPct: 38,
    fixedCost: 60,
    mrp: 1499,
    imageSeed: "canvas-espadrilles",
  },
  {
    name: "Formal Leather Oxfords",
    category: "footwear",
    gender: "MEN",
    description: "Hand-finished leather Oxfords with a Goodyear-welted sole, resoleable for a lifetime of wear.",
    tags: ["oxfords", "formal", "leather"],
    sizes: ["6", "7", "8", "9", "10", "11"],
    colors: [{ name: "Black", hex: "#1B1B1B" }, { name: "Brown", hex: "#5C3A21" }],
    purchasePrice: 2100,
    marginPct: 30,
    fixedCost: 130,
    mrp: 5999,
    imageSeed: "formal-oxfords",
  },
];

const STORE_LOCATIONS = [
  {
    name: "LuxeLoom Bandra",
    address: "Shop 4, Linking Road, Bandra West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400050",
    lat: 19.0596,
    lng: 72.8295,
    phone: "+91 22 4001 2233",
  },
  {
    name: "LuxeLoom Khan Market",
    address: "12 Middle Lane, Khan Market",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110003",
    lat: 28.6002,
    lng: 77.2276,
    phone: "+91 11 4155 6677",
  },
  {
    name: "LuxeLoom Indiranagar",
    address: "100 Feet Road, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560038",
    lat: 12.9719,
    lng: 77.6412,
    phone: "+91 80 4123 8899",
  },
];

const STORE_HOURS = (["MON", "TUE", "WED", "THU", "FRI", "SAT"] as const).map((day) => ({
  day,
  open: "10:00",
  close: "20:00",
}));
const SUNDAY_HOURS = { day: "SUN" as const, open: "11:00", close: "19:00" };

async function uploadPlaceholder(seed: string, folder: string, publicId: string) {
  const remoteUrl = `https://picsum.photos/seed/${seed}/900/1200`;
  const result = await cloudinary.uploader.upload(remoteUrl, {
    folder,
    public_id: publicId,
    overwrite: true,
  });
  return { publicId: result.public_id, secureUrl: result.secure_url };
}

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set in .env.local — add your Atlas connection string first.");
  }
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error("CLOUDINARY_CLOUD_NAME is not set in .env.local — add your Cloudinary credentials first.");
  }

  console.log("Connecting to MongoDB Atlas…");
  await mongoose.connect(uri);

  console.log("Clearing existing seed collections…");
  await Promise.all([
    Category.deleteMany({}),
    Product.deleteMany({}),
    StoreLocation.deleteMany({}),
  ]);

  console.log("Seeding categories…");
  const categoryDocs = await Category.insertMany(
    CATEGORIES.map((c, i) => ({ name: c.name, slug: c.slug, order: i }))
  );
  const categoryBySlug = new Map(categoryDocs.map((c) => [c.slug, c._id]));

  console.log("Seeding store locations…");
  await StoreLocation.insertMany(
    STORE_LOCATIONS.map((s) => ({ ...s, hours: [...STORE_HOURS, SUNDAY_HOURS], active: true }))
  );

  console.log(`Seeding ${PRODUCTS.length} products (uploading placeholder images to Cloudinary)…`);
  let i = 0;
  for (const p of PRODUCTS) {
    i++;
    const slug = slugify(p.name);
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

    const pricing = seedPricing({
      purchasePrice: p.purchasePrice,
      marginPct: p.marginPct,
      fixedCost: p.fixedCost,
      mrp: p.mrp,
    });

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
      pricing,
      status: "PUBLISHED",
    });

    console.log(`  [${i}/${PRODUCTS.length}] ${p.name}`);
  }

  console.log("Done.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
