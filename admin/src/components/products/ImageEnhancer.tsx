"use client";

import { useRef, useState } from "react";
import { enhanceImage, type EnhanceImageResult, type ImageStatus } from "@/lib/products";
import { ApiRequestError } from "@/lib/api";

export interface ResolvedImage {
  originalPublicId: string;
  originalUrl: string;
  enhancedPublicId?: string;
  enhancedUrl?: string;
  geminiModel?: string;
  status: ImageStatus;
}

type Stage = "idle" | "uploading" | "review" | "error";
type Tier = "fast" | "primary";

export function ImageEnhancer({ onResolved }: { onResolved: (image: ResolvedImage) => void }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [tier, setTier] = useState<Tier>("fast");
  const [result, setResult] = useState<EnhanceImageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runEnhance(file: File, selectedTier: Tier) {
    setStage("uploading");
    setError(null);
    try {
      const res = await enhanceImage(file, selectedTier);
      setResult(res);
      setStage("review");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Enhancement failed");
      setStage("error");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileRef.current = file;
    runEnhance(file, tier);
  }

  function reset() {
    setStage("idle");
    setResult(null);
    setError(null);
    fileRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
  }

  function accept() {
    if (!result?.enhanced) return;
    onResolved({
      originalPublicId: result.original.publicId,
      originalUrl: result.original.url,
      enhancedPublicId: result.enhanced.publicId,
      enhancedUrl: result.enhanced.url,
      geminiModel: result.enhanced.model,
      status: "accepted",
    });
    reset();
  }

  function useOriginal() {
    if (!result) return;
    onResolved({
      originalPublicId: result.original.publicId,
      originalUrl: result.original.url,
      status: "original",
    });
    reset();
  }

  function rerun() {
    if (fileRef.current) runEnhance(fileRef.current, tier);
  }

  return (
    <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
      {stage === "idle" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Add a product photo</p>
            <p className="text-xs text-black/60 dark:text-white/60">
              We&apos;ll restage it as a clean catalog shot with Gemini before it&apos;s added.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as Tier)}
              className="h-10 rounded-lg border border-black/15 bg-transparent px-2 text-sm dark:border-white/20"
            >
              <option value="fast">Fast (Nano Banana 2)</option>
              <option value="primary">Pro (Nano Banana Pro)</option>
            </select>
            <label className="flex h-10 cursor-pointer items-center justify-center rounded-full bg-black px-4 text-sm font-medium text-white dark:bg-white dark:text-black">
              Add image
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>
        </div>
      )}

      {stage === "uploading" && (
        <div className="flex items-center gap-3 py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black dark:border-white/20 dark:border-t-white" />
          <p className="text-sm text-black/60 dark:text-white/60">
            Sending to Gemini ({tier === "primary" ? "Nano Banana Pro" : "Nano Banana 2"})…
          </p>
        </div>
      )}

      {stage === "error" && (
        <div className="py-2">
          <p className="text-sm text-red-600">{error}</p>
          <button type="button" onClick={reset} className="mt-2 text-sm font-medium underline">
            Try again
          </button>
        </div>
      )}

      {stage === "review" && result && (
        <div>
          {result.enhanced ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-xs font-medium text-black/60 dark:text-white/60">Before</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- transient admin-only preview, not the customer-facing path */}
                <img
                  src={result.original.url}
                  alt="Original upload"
                  className="aspect-square w-full rounded-lg object-cover"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-black/60 dark:text-white/60">After (Gemini)</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- transient admin-only preview, not the customer-facing path */}
                <img
                  src={result.enhanced.url}
                  alt="Gemini-enhanced"
                  className="aspect-square w-full rounded-lg object-cover"
                />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-red-600">
                {result.enhanceError ?? "Enhancement failed"}. You can still use the original photo.
              </p>
              <div className="mt-2 w-32">
                {/* eslint-disable-next-line @next/next/no-img-element -- transient admin-only preview, not the customer-facing path */}
                <img
                  src={result.original.url}
                  alt="Original upload"
                  className="aspect-square w-full rounded-lg object-cover"
                />
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {result.enhanced && (
              <button
                type="button"
                onClick={accept}
                className="h-10 rounded-full bg-black px-4 text-sm font-medium text-white dark:bg-white dark:text-black"
              >
                Accept enhanced
              </button>
            )}
            <button
              type="button"
              onClick={useOriginal}
              className="h-10 rounded-full border border-black/15 px-4 text-sm font-medium dark:border-white/20"
            >
              Use original instead
            </button>
            <button
              type="button"
              onClick={rerun}
              className="h-10 rounded-full border border-black/15 px-4 text-sm font-medium dark:border-white/20"
            >
              Re-run
            </button>
            <button
              type="button"
              onClick={reset}
              className="h-10 rounded-full px-4 text-sm font-medium text-black/60 dark:text-white/60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
