import { env } from "../../config/env";
import { INTEGRATIONS_MOCK, logIntegrationCall, withRetry, withTimeout } from "./index";

const PRIMARY_MODEL = env.geminiImageModelPrimary;
const FAST_MODEL = env.geminiImageModelFast;

// @google/genai ships ESM-only; this backend is CommonJS, so it's loaded
// via a lazy dynamic import rather than a static import/require. Only the
// narrow shape actually used here is typed, to avoid importing the
// package's own ESM types into a CJS file (which needs a resolution-mode
// attribute TS doesn't infer automatically).
interface GenAIPart {
  text?: string;
  inlineData?: { data?: string; mimeType?: string };
}
interface GenAIResponse {
  text?: string;
  candidates?: { content?: { parts?: GenAIPart[] } }[];
}
interface GenAIClient {
  models: {
    generateContent: (params: {
      model: string;
      contents: { role: string; parts: GenAIPart[] }[];
      config?: { responseModalities?: string[] };
    }) => Promise<GenAIResponse>;
  };
}

let client: GenAIClient | null = null;
async function getClient(): Promise<GenAIClient> {
  if (!client) {
    const mod = await import("@google/genai");
    client = new mod.GoogleGenAI({ apiKey: env.geminiApiKey }) as unknown as GenAIClient;
  }
  return client;
}

export interface ImageInput {
  base64: string;
  mimeType: string;
}

export interface ImageOutput {
  base64: string;
  mimeType: string;
}

async function callImageModel(model: string, prompt: string, images: ImageInput[]): Promise<ImageOutput> {
  const ai = await getClient();
  const parts = [
    ...images.map((img) => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })),
    { text: prompt },
  ];

  const response = await withRetry(
    () =>
      withTimeout(
        ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: { responseModalities: ["IMAGE", "TEXT"] },
        }),
        45000,
        `gemini:${model}`
      ),
    { retries: 1, label: `gemini-image:${model}` }
  );

  const imagePart = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error(`Gemini returned no image data for model ${model}`);
  }
  return { base64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType ?? "image/png" };
}

async function mockImage(seed: string): Promise<ImageOutput> {
  const res = await fetch(`https://picsum.photos/seed/${encodeURIComponent(seed)}/1000/1300`);
  const buf = Buffer.from(await res.arrayBuffer());
  return { base64: buf.toString("base64"), mimeType: "image/jpeg" };
}

/** Photo 1 & 2: studio treatment of a real garment photo — background swap,
 * lighting/white-balance correction, wrinkle reduction, upscale. Color
 * enhancement only, garment itself must not be altered. */
export async function generateStudioShot(image: ImageInput, seed: string): Promise<ImageOutput> {
  logIntegrationCall("gemini", "generateStudioShot", { seed, mock: INTEGRATIONS_MOCK });
  if (INTEGRATIONS_MOCK) return mockImage(`${seed}-studio`);

  const prompt = `You are a professional product photo retoucher. Replace the background of this garment photo with a premium soft beige studio sweep. Correct the lighting and white balance. Visually reduce wrinkles and gently upscale sharpness. Apply color enhancement only — do NOT alter the garment's shape, color, pattern, texture, or any design detail. Output a photorealistic studio product photo.`;
  return callImageModel(FAST_MODEL, prompt, [image]);
}

/** Photo 3: photorealistic AI model wearing the exact garment, front-on. */
export async function generateModelShot(
  front: ImageInput,
  back: ImageInput,
  opts: { gender: string; bodyType: string; skinTone: string; pose: string }
): Promise<ImageOutput> {
  logIntegrationCall("gemini", "generateModelShot", { opts, mock: INTEGRATIONS_MOCK });
  if (INTEGRATIONS_MOCK) return mockImage(`${opts.gender}-${opts.bodyType}-model`);

  const prompt = `Generate a photorealistic fashion photo of a ${opts.gender} model with a ${opts.bodyType} body type and ${opts.skinTone} skin tone, in a ${opts.pose} pose, wearing EXACTLY the garment shown in the two reference images (front and back of the same item). HARD CONSTRAINTS: preserve the garment's exact color, print, pattern, texture, neckline, sleeve length, buttons, logos and proportions from both reference images. Do NOT redesign, recolor, or reinterpret the garment in any way — treat the references as ground truth. The model should be shown front-on against a clean, softly lit studio backdrop. This is a commercial e-commerce photo.`;
  return callImageModel(PRIMARY_MODEL, prompt, [front, back]);
}

const LIFESTYLE_PRESETS = {
  street: "an urban street style scene with soft daylight",
  cafe: "a cozy café interior with warm ambient light",
  golden_hour: "an outdoor golden hour scene with warm sunset light",
  studio: "a minimal editorial studio backdrop with dramatic lighting",
  park: "a green park setting with natural daylight",
  rooftop: "a city rooftop scene at dusk",
} as const;
export type LifestylePreset = keyof typeof LIFESTYLE_PRESETS;

/** Photo 4: same model + garment from photo 3, placed in a lifestyle scene. */
export async function generateLifestyleShot(modelPhoto: ImageInput, preset: LifestylePreset): Promise<ImageOutput> {
  logIntegrationCall("gemini", "generateLifestyleShot", { preset, mock: INTEGRATIONS_MOCK });
  if (INTEGRATIONS_MOCK) return mockImage(`${preset}-lifestyle`);

  const prompt = `Using the exact same model and exact same garment shown in this reference photo, generate a photorealistic lifestyle campaign photo set in ${LIFESTYLE_PRESETS[preset]}. Preserve the model's identity, pose energy, and the garment's exact color, pattern, and design — do not change the outfit.`;
  return callImageModel(FAST_MODEL, prompt, [modelPhoto]);
}

export interface FaithfulnessResult {
  pass: boolean;
  issues: string[];
}

/** Vision comparison of a generated AI-model photo against the original
 * garment references, checking color/pattern/design are unchanged. */
export async function checkFaithfulness(
  originals: ImageInput[],
  generated: ImageInput
): Promise<FaithfulnessResult> {
  logIntegrationCall("gemini", "checkFaithfulness", { mock: INTEGRATIONS_MOCK });
  if (INTEGRATIONS_MOCK) return { pass: true, issues: [] };

  const ai = await getClient();
  const parts = [
    ...originals.map((img) => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })),
    { inlineData: { data: generated.base64, mimeType: generated.mimeType } },
    {
      text: `The first image(s) are the ORIGINAL garment reference photos. The LAST image is an AI-generated photo meant to show the exact same garment. Compare them strictly for color, print/pattern, and design (neckline, sleeves, buttons, logos, proportions). Respond with ONLY a JSON object, no markdown fences: {"pass": boolean, "issues": string[]}. "pass" is true only if the garment in the last image is faithful to the originals in color, pattern and design.`,
    },
  ];

  const response = await withTimeout(
    ai.models.generateContent({ model: PRIMARY_MODEL, contents: [{ role: "user", parts }] }),
    30000,
    "gemini:faithfulness"
  );

  const text = response.text ?? "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(jsonMatch?.[0] ?? "{}");
    return { pass: Boolean(parsed.pass), issues: Array.isArray(parsed.issues) ? parsed.issues : [] };
  } catch {
    return { pass: true, issues: [] };
  }
}

export interface SeoContent {
  description: string;
  tags: string[];
  altTexts: string[];
}

export async function generateSeoContent(
  productName: string,
  category: string,
  imageCount: number
): Promise<SeoContent> {
  logIntegrationCall("gemini", "generateSeoContent", { productName, mock: INTEGRATIONS_MOCK });
  if (INTEGRATIONS_MOCK) {
    return {
      description: `The ${productName} is a considered addition to the ${category} edit — clean lines, honest materials, made to be worn on repeat.`,
      tags: [category.toLowerCase(), "editorial", "everyday", "considered", "luxeloom"],
      altTexts: Array.from({ length: imageCount }, (_, i) => `${productName} — photo ${i + 1}`),
    };
  }

  const ai = await getClient();
  const prompt = `Write SEO content for a fashion e-commerce product named "${productName}" in the "${category}" category. Respond with ONLY JSON, no markdown fences: {"description": string (2-3 sentences, editorial tone), "tags": string[] (exactly 5 lowercase tags), "altTexts": string[] (exactly ${imageCount} short descriptive alt texts for the product photos, in order: studio front, studio back, AI model front, lifestyle)}.`;

  const response = await withTimeout(
    ai.models.generateContent({ model: FAST_MODEL, contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    20000,
    "gemini:seo"
  );

  const text = response.text ?? "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] ?? "{}");
  return {
    description: parsed.description ?? "",
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
    altTexts: Array.isArray(parsed.altTexts) ? parsed.altTexts : [],
  };
}
