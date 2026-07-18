import { Router } from "express";
import { z } from "zod";
import { Product } from "../models/Product";
import { Category } from "../models/Category";
import { requireCatalog } from "../middleware/auth";
import { uploadImage, productFolder } from "../lib/cloudinary";
import {
  generateStudioShot,
  generateModelShot,
  generateLifestyleShot,
  checkFaithfulness,
  generateSeoContent,
  type ImageInput,
  type LifestylePreset,
} from "../lib/integrations/gemini";
import { createJob, getJob, updateSlot, finishJob, type PhotoSlot, type PhotoJobState } from "../lib/photoStudioJobs";
import { withTimeout } from "../lib/integrations";

const router = Router();
router.use(requireCatalog);

async function fetchAsImageInput(url: string): Promise<ImageInput> {
  // Every other outbound fetch in this codebase goes through withTimeout —
  // this one didn't, so a hung source URL blocked the request indefinitely.
  const res = await withTimeout(fetch(url), 15000, "photoStudio:fetchAsImageInput");
  const buf = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  return { base64: buf.toString("base64"), mimeType };
}

async function saveGeneratedImage(
  productId: string,
  slug: string,
  type: "STUDIO" | "AI_MODEL",
  slotMeta: { side?: "FRONT" | "BACK"; slot?: "MODEL_FRONT" | "LIFESTYLE" },
  image: ImageInput,
  faithfulnessFlag: boolean
) {
  const dataUri = `data:${image.mimeType};base64,${image.base64}`;
  const uploaded = await uploadImage(dataUri, { folder: productFolder(slug) });

  const product = await Product.findById(productId);
  if (!product) throw new Error("Product disappeared mid-job");

  // Replace any prior generated image occupying the same side/slot.
  product.images = product.images.filter((img) => {
    if (img.type !== type) return true;
    if (type === "STUDIO") return img.side !== slotMeta.side;
    return img.slot !== slotMeta.slot;
  }) as typeof product.images;

  product.images.push({
    publicId: uploaded.publicId,
    secureUrl: uploaded.secureUrl,
    type,
    side: slotMeta.side,
    slot: slotMeta.slot,
    order: product.images.length,
    faithfulnessFlag,
  } as (typeof product.images)[number]);
  await product.save();

  return { publicId: uploaded.publicId, secureUrl: uploaded.secureUrl };
}

const MODEL_OPTIONS_DEFAULTS: Record<string, { gender: string; bodyType: string; skinTone: string; pose: string }> = {
  MEN: { gender: "male", bodyType: "athletic", skinTone: "medium", pose: "standing, front-facing, hands relaxed" },
  WOMEN: { gender: "female", bodyType: "average", skinTone: "medium", pose: "standing, front-facing, hands relaxed" },
  UNISEX: { gender: "androgynous", bodyType: "average", skinTone: "medium", pose: "standing, front-facing, hands relaxed" },
};

const startSchema = z.object({
  modelOptions: z
    .object({ gender: z.string(), bodyType: z.string(), skinTone: z.string(), pose: z.string() })
    .partial()
    .optional(),
  lifestylePreset: z.string().optional(),
});

router.post("/:id/photo-studio", async (req, res) => {
  const parsed = startSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const front = product.images.find((img) => img.type === "ORIGINAL" && img.side === "FRONT");
  const back = product.images.find((img) => img.type === "ORIGINAL" && img.side === "BACK");
  if (!front || !back) {
    return res.status(400).json({ error: "Upload both a FRONT and BACK original photo before generating sales photos" });
  }

  // Regenerate-all: clear any previously generated STUDIO/AI_MODEL photos.
  product.images = product.images.filter((img) => img.type === "ORIGINAL") as typeof product.images;
  await product.save();

  const { jobId, entry } = createJob(String(product._id));
  res.status(202).json({ jobId });

  const modelDefaults = MODEL_OPTIONS_DEFAULTS[product.gender ?? "UNISEX"];
  const modelOptions = { ...modelDefaults, ...parsed.data.modelOptions };
  const lifestylePreset = (parsed.data.lifestylePreset as LifestylePreset) ?? "street";

  runPhotoStudioJob({
    productId: String(product._id),
    slug: product.slug,
    frontUrl: front.secureUrl,
    backUrl: back.secureUrl,
    modelOptions,
    lifestylePreset,
    entry,
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("photo-studio job crashed:", err);
    finishJob(entry);
  });
});

async function runPhotoStudioJob(opts: {
  productId: string;
  slug: string;
  frontUrl: string;
  backUrl: string;
  modelOptions: { gender: string; bodyType: string; skinTone: string; pose: string };
  lifestylePreset: LifestylePreset;
  entry: ReturnType<typeof createJob>["entry"];
}) {
  const { productId, slug, entry } = opts;
  const front = await fetchAsImageInput(opts.frontUrl);
  const back = await fetchAsImageInput(opts.backUrl);

  // Photos 1 & 2 run in parallel — independent, no faithfulness gate.
  const studioResults = await Promise.allSettled([
    (async () => {
      updateSlot(entry, "studio_front", { status: "generating" });
      const img = await generateStudioShot(front, `${slug}-front`);
      const saved = await saveGeneratedImage(productId, slug, "STUDIO", { side: "FRONT" }, img, false);
      updateSlot(entry, "studio_front", { status: "done", imageUrl: saved.secureUrl, imageId: saved.publicId });
    })(),
    (async () => {
      updateSlot(entry, "studio_back", { status: "generating" });
      const img = await generateStudioShot(back, `${slug}-back`);
      const saved = await saveGeneratedImage(productId, slug, "STUDIO", { side: "BACK" }, img, false);
      updateSlot(entry, "studio_back", { status: "done", imageUrl: saved.secureUrl, imageId: saved.publicId });
    })(),
  ]);
  studioResults.forEach((r, i) => {
    if (r.status === "rejected") {
      const slot: PhotoSlot = i === 0 ? "studio_front" : "studio_back";
      updateSlot(entry, slot, { status: "failed", error: String(r.reason) });
    }
  });

  // Photo 3: AI model shot, with faithfulness-checked auto-regeneration.
  let modelImage: { img: ImageInput; url: string } | null = null;
  try {
    updateSlot(entry, "model_front", { status: "generating", attempt: 1 });
    let img = await generateModelShot(front, back, opts.modelOptions);
    let check = await runFaithfulnessCheck(entry, "model_front", [front, back], img, 1);

    let attempt = 1;
    while (!check.pass && attempt < 3) {
      attempt++;
      updateSlot(entry, "model_front", { status: "regenerating", attempt });
      img = await generateModelShot(front, back, opts.modelOptions);
      check = await runFaithfulnessCheck(entry, "model_front", [front, back], img, attempt);
    }

    const saved = await saveGeneratedImage(productId, slug, "AI_MODEL", { slot: "MODEL_FRONT" }, img, !check.pass);
    updateSlot(entry, "model_front", {
      status: check.pass ? "done" : "flagged",
      imageUrl: saved.secureUrl,
      imageId: saved.publicId,
      issues: check.issues,
    });
    modelImage = { img, url: saved.secureUrl };
  } catch (err) {
    updateSlot(entry, "model_front", { status: "failed", error: String(err) });
  }

  // Photo 4: lifestyle shot built from photo 3 — only runs if photo 3 exists.
  if (modelImage) {
    try {
      updateSlot(entry, "lifestyle", { status: "generating", attempt: 1 });
      let img = await generateLifestyleShot(modelImage.img, opts.lifestylePreset);
      let check = await runFaithfulnessCheck(entry, "lifestyle", [front, back], img, 1);

      let attempt = 1;
      while (!check.pass && attempt < 3) {
        attempt++;
        updateSlot(entry, "lifestyle", { status: "regenerating", attempt });
        img = await generateLifestyleShot(modelImage.img, opts.lifestylePreset);
        check = await runFaithfulnessCheck(entry, "lifestyle", [front, back], img, attempt);
      }

      const saved = await saveGeneratedImage(productId, slug, "AI_MODEL", { slot: "LIFESTYLE" }, img, !check.pass);
      updateSlot(entry, "lifestyle", {
        status: check.pass ? "done" : "flagged",
        imageUrl: saved.secureUrl,
        imageId: saved.publicId,
        issues: check.issues,
      });
    } catch (err) {
      updateSlot(entry, "lifestyle", { status: "failed", error: String(err) });
    }
  } else {
    updateSlot(entry, "lifestyle", { status: "failed", error: "Skipped — model photo failed" });
  }

  // Draft SEO content once the set is in.
  try {
    const product = await Product.findById(productId);
    if (product && !product.description) {
      const category = await Category.findById(product.category).select("name").lean();
      const seo = await generateSeoContent(product.name, category?.name ?? "fashion", 4);
      product.description = seo.description;
      // Merge rather than replace — the admin's own tags (including the
      // Shirts/T-Shirts/etc. type tag the storefront filter matches on)
      // must survive this AI draft, not be wiped by it.
      product.tags = [...new Set([...(product.tags ?? []), ...seo.tags])];
      await product.save();
    }
  } catch {
    // SEO drafting is a nice-to-have; never fail the job over it.
  }

  finishJob(entry);
}

async function runFaithfulnessCheck(
  entry: ReturnType<typeof createJob>["entry"],
  slot: PhotoSlot,
  originals: ImageInput[],
  generated: ImageInput,
  attempt: number
) {
  updateSlot(entry, slot, { status: "checking", attempt });
  return checkFaithfulness(originals, generated);
}

router.get("/:id/photo-studio/:jobId/stream", (req, res) => {
  const entry = getJob(req.params.jobId);
  if (!entry) return res.status(404).json({ error: "Job not found" });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (state: PhotoJobState) => res.write(`data: ${JSON.stringify(state)}\n\n`);
  send(entry.state);

  // The job may already have finished by the time this connects (mock mode
  // resolves near-instantly) — its "done" event would already have fired
  // into an empty listener list, so the stream must close itself here
  // rather than wait for an event that already happened.
  if (entry.state.done) {
    res.end();
    return;
  }

  const onUpdate = (state: PhotoJobState) => send(state);
  entry.emitter.on("update", onUpdate);

  const onDone = () => res.end();
  entry.emitter.on("done", onDone);

  req.on("close", () => {
    entry.emitter.off("update", onUpdate);
    entry.emitter.off("done", onDone);
  });
});

const regenerateSchema = z.object({ instruction: z.string().optional() });

router.post("/:id/photo-studio/regenerate/:slot", async (req, res) => {
  const slot = req.params.slot as PhotoSlot;
  if (!["studio_front", "studio_back", "model_front", "lifestyle"].includes(slot)) {
    return res.status(400).json({ error: "Unknown photo slot" });
  }
  const parsed = regenerateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const front = product.images.find((img) => img.type === "ORIGINAL" && img.side === "FRONT");
  const back = product.images.find((img) => img.type === "ORIGINAL" && img.side === "BACK");
  if (!front || !back) return res.status(400).json({ error: "Missing original photos" });

  const frontInput = await fetchAsImageInput(front.secureUrl);
  const backInput = await fetchAsImageInput(back.secureUrl);
  const extra = parsed.data.instruction ? `\nAdditional instruction: ${parsed.data.instruction}` : "";

  try {
    let img: ImageInput;
    let saved: { publicId: string; secureUrl: string };
    let faithfulnessFlag = false;
    let issues: string[] = [];

    if (slot === "studio_front" || slot === "studio_back") {
      const source = slot === "studio_front" ? frontInput : backInput;
      img = await generateStudioShot({ ...source, base64: source.base64 }, `${product.slug}-${slot}${extra}`);
      saved = await saveGeneratedImage(
        String(product._id),
        product.slug,
        "STUDIO",
        { side: slot === "studio_front" ? "FRONT" : "BACK" },
        img,
        false
      );
    } else if (slot === "model_front") {
      const modelDefaults = MODEL_OPTIONS_DEFAULTS[product.gender ?? "UNISEX"];
      img = await generateModelShot(frontInput, backInput, modelDefaults);
      const check = await checkFaithfulness([frontInput, backInput], img);
      faithfulnessFlag = !check.pass;
      issues = check.issues;
      saved = await saveGeneratedImage(String(product._id), product.slug, "AI_MODEL", { slot: "MODEL_FRONT" }, img, faithfulnessFlag);
    } else {
      const modelPhoto = product.images.find((i) => i.type === "AI_MODEL" && i.slot === "MODEL_FRONT");
      if (!modelPhoto) return res.status(400).json({ error: "Generate the AI model photo first" });
      const modelInput = await fetchAsImageInput(modelPhoto.secureUrl);
      img = await generateLifestyleShot(modelInput, "street");
      const check = await checkFaithfulness([frontInput, backInput], img);
      faithfulnessFlag = !check.pass;
      issues = check.issues;
      saved = await saveGeneratedImage(String(product._id), product.slug, "AI_MODEL", { slot: "LIFESTYLE" }, img, faithfulnessFlag);
    }

    res.json({ image: saved, faithfulnessFlag, issues });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Regeneration failed" });
  }
});

export default router;
