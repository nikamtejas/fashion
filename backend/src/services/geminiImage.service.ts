import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// Fixed edit prompt from SPEC.md §4.1. This is an image *edit* (photo + instruction),
// not text-to-image generation — that distinction is what keeps the result looking
// like a real photo of the actual garment instead of an AI-invented one. Keep this
// prompt restrained; a fancier prompt reads as more obviously AI-generated.
const DEFAULT_EDIT_PROMPT =
  "Edit this photo of a clothing item into a professional e-commerce product photo. " +
  "Keep the garment's exact color, pattern, texture, and design completely unchanged — " +
  "do not alter or reinterpret the print, fabric, or shape. Place it on a clean, evenly " +
  "lit studio background (soft light gray or white), remove clutter and background " +
  "distractions, correct exposure and color balance, and present it centered and " +
  "well-framed as it would appear on a fashion retail website. The result should look " +
  "like a real photograph taken in a studio, not an illustration or an obviously " +
  "AI-generated image.";

export type GeminiImageTier = "primary" | "fast";

export interface EditImageResult {
  buffer: Buffer;
  mimeType: string;
  model: string;
}

export async function editProductImage({
  buffer,
  mimeType,
  tier = "fast",
  promptOverride,
}: {
  buffer: Buffer;
  mimeType: string;
  tier?: GeminiImageTier;
  promptOverride?: string;
}): Promise<EditImageResult> {
  const model = tier === "primary" ? env.GEMINI_IMAGE_MODEL_PRIMARY : env.GEMINI_IMAGE_MODEL_FAST;
  const prompt = promptOverride?.trim() || DEFAULT_EDIT_PROMPT;

  const chat = ai.chats.create({
    model,
    // Nano Banana Pro supports imageConfig even in edit mode; the fast tier's edit
    // mode doesn't reliably support extra config, so we leave it at model defaults.
    ...(tier === "primary" ? { config: { imageConfig: { imageSize: "2K" as const } } } : {}),
  });

  let response;
  try {
    response = await chat.sendMessage({
      message: [{ inlineData: { data: buffer.toString("base64"), mimeType } }, prompt],
    });
  } catch (err) {
    throw new ApiError(502, "Gemini image edit request failed", {
      model,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    const textPart = parts.find((part) => part.text)?.text;
    throw new ApiError(502, "Gemini did not return an edited image", { model, textResponse: textPart });
  }

  return {
    buffer: Buffer.from(imagePart.inlineData.data, "base64"),
    mimeType: imagePart.inlineData.mimeType ?? "image/png",
    model,
  };
}
