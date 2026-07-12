"use client";

import * as React from "react";
import { Sparkles, RotateCcw, Trash2, Upload, AlertTriangle, CheckCircle2, Star } from "lucide-react";
import { apiFetch, API_URL } from "@/lib/api";
import { fileToDataUri } from "@/lib/imageQuality";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { PhotoDropzone } from "@/components/admin/PhotoDropzone";
import { BeforeAfterSlider } from "@/components/admin/BeforeAfterSlider";
import type { WizardProduct, WizardImage } from "./types";

type Slot = "studio_front" | "studio_back" | "model_front" | "lifestyle";

interface PhotoSlotState {
  status: "pending" | "generating" | "checking" | "regenerating" | "done" | "failed" | "flagged";
  imageUrl?: string;
  error?: string;
  issues?: string[];
}
interface JobState {
  photos: Record<Slot, PhotoSlotState>;
  done: boolean;
}

const SLOT_LABELS: Record<Slot, string> = {
  studio_front: "1. Studio — Front",
  studio_back: "2. Studio — Back",
  model_front: "3. AI Model — Front",
  lifestyle: "4. Lifestyle Campaign",
};

const LIFESTYLE_PRESETS = [
  { value: "street", label: "Street style" },
  { value: "cafe", label: "Café" },
  { value: "golden_hour", label: "Golden hour" },
  { value: "studio", label: "Editorial studio" },
  { value: "park", label: "Park" },
  { value: "rooftop", label: "Rooftop" },
];

export function ImagesStep({
  product,
  onProductChange,
  onNext,
  onBack,
}: {
  product: WizardProduct;
  onProductChange: (p: WizardProduct) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [jobState, setJobState] = React.useState<JobState | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [lifestylePreset, setLifestylePreset] = React.useState("street");
  const [modelOptions, setModelOptions] = React.useState({
    gender: product.gender === "MEN" ? "male" : product.gender === "WOMEN" ? "female" : "androgynous",
    bodyType: "average",
    skinTone: "medium",
    pose: "standing, front-facing",
  });

  const front = product.images.find((i) => i.type === "ORIGINAL" && i.side === "FRONT");
  const back = product.images.find((i) => i.type === "ORIGINAL" && i.side === "BACK");
  const studioFront = product.images.find((i) => i.type === "STUDIO" && i.side === "FRONT");
  const studioBack = product.images.find((i) => i.type === "STUDIO" && i.side === "BACK");
  const modelFront = product.images.find((i) => i.type === "AI_MODEL" && i.slot === "MODEL_FRONT");
  const lifestyle = product.images.find((i) => i.type === "AI_MODEL" && i.slot === "LIFESTYLE");

  // Which photo the storefront poster currently uses — an explicit cover
  // choice, else the same default the backend applies (studio front, then
  // any generated shot, then the first upload).
  const effectiveCoverId = (
    product.images.find((i) => i.isCover) ??
    studioFront ??
    product.images.find((i) => i.type !== "ORIGINAL") ??
    product.images[0]
  )?._id;

  async function refetchProduct() {
    const data = await apiFetch<{ product: WizardProduct }>(`/api/admin/products/${product._id}`);
    onProductChange(data.product);
    return data.product;
  }

  async function handleUploadOriginal(side: "FRONT" | "BACK", dataUri: string) {
    try {
      const data = await apiFetch<{ product: WizardProduct }>(`/api/admin/products/${product._id}/images`, {
        method: "POST",
        json: { dataUri, side, type: "ORIGINAL" },
      });
      onProductChange(data.product);
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setJobState(null);
    try {
      const { jobId } = await apiFetch<{ jobId: string }>(`/api/admin/products/${product._id}/photo-studio`, {
        method: "POST",
        json: { modelOptions, lifestylePreset },
      });

      const es = new EventSource(`${API_URL}/api/admin/products/${product._id}/photo-studio/${jobId}/stream`, {
        withCredentials: true,
      });
      es.onmessage = (ev) => {
        const state = JSON.parse(ev.data) as JobState;
        setJobState(state);
        if (state.done) {
          es.close();
          setGenerating(false);
          refetchProduct();
        }
      };
      es.onerror = () => {
        es.close();
        setGenerating(false);
        refetchProduct();
      };
    } catch (err) {
      setGenerating(false);
      toast({ title: "Couldn't start generation", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }

  async function handleRegenerate(slot: Slot, instruction?: string) {
    setJobState((prev) => ({
      photos: { ...(prev?.photos ?? emptyPhotos()), [slot]: { status: "regenerating" } },
      done: false,
    }));
    try {
      await apiFetch(`/api/admin/products/${product._id}/photo-studio/regenerate/${slot}`, {
        method: "POST",
        json: { instruction },
      });
      await refetchProduct();
      toast({ title: "Regenerated", variant: "success" });
    } catch (err) {
      toast({ title: "Regeneration failed", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setJobState(null);
    }
  }

  async function handleDiscard(image: WizardImage) {
    await apiFetch(`/api/admin/products/${product._id}/images/${image._id}`, { method: "DELETE" });
    await refetchProduct();
  }

  async function handleSetCover(image: WizardImage) {
    try {
      await apiFetch(`/api/admin/products/${product._id}/images/${image._id}/cover`, { method: "PATCH" });
      await refetchProduct();
      toast({ title: "Storefront cover updated", description: "This photo now leads the shop card and gallery.", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't set cover", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }

  /** Badge when the photo is the current storefront poster, otherwise a
   * one-click switch — the explicit original-vs-generated choice. */
  function coverControl(image?: WizardImage) {
    if (!image) return null;
    return image._id === effectiveCoverId ? (
      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">
        <Star className="h-3 w-3 fill-current" /> Storefront cover
      </span>
    ) : (
      <button
        type="button"
        onClick={() => handleSetCover(image)}
        className="mt-1.5 flex items-center gap-1 text-[11px] text-foreground/50 underline underline-offset-2 hover:text-foreground"
      >
        <Star className="h-3 w-3" /> Use as storefront cover
      </button>
    );
  }

  async function handleReplaceOwnPhoto(image: WizardImage, file: File) {
    const dataUri = await fileToDataUri(file);
    await apiFetch(`/api/admin/products/${product._id}/images`, {
      method: "POST",
      json: { dataUri, type: image.type, side: image.side, slot: image.slot, replaceImageId: image._id },
    });
    await refetchProduct();
  }

  const canGenerate = Boolean(front && back);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <p className="mb-4 text-sm text-foreground/60">
          Upload one casual photo of the garment&rsquo;s front and one of its back. LuxeLoom will turn these into a
          four-photo sales set.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          <div>
            <PhotoDropzone label="Front" currentUrl={front?.secureUrl} onSelect={(uri) => handleUploadOriginal("FRONT", uri)} />
            {coverControl(front)}
          </div>
          <div>
            <PhotoDropzone label="Back" currentUrl={back?.secureUrl} onSelect={(uri) => handleUploadOriginal("BACK", uri)} />
            {coverControl(back)}
          </div>
        </div>
      </div>

      {canGenerate && (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <LabeledSelect
              label="Model gender"
              value={modelOptions.gender}
              onChange={(v) => setModelOptions((s) => ({ ...s, gender: v }))}
              options={["male", "female", "androgynous"]}
            />
            <LabeledSelect
              label="Body type"
              value={modelOptions.bodyType}
              onChange={(v) => setModelOptions((s) => ({ ...s, bodyType: v }))}
              options={["slim", "average", "athletic", "curvy", "plus-size"]}
            />
            <LabeledSelect
              label="Skin tone"
              value={modelOptions.skinTone}
              onChange={(v) => setModelOptions((s) => ({ ...s, skinTone: v }))}
              options={["fair", "light", "medium", "tan", "deep"]}
            />
            <LabeledSelect
              label="Lifestyle scene"
              value={lifestylePreset}
              onChange={setLifestylePreset}
              options={LIFESTYLE_PRESETS.map((p) => p.value)}
              labels={Object.fromEntries(LIFESTYLE_PRESETS.map((p) => [p.value, p.label]))}
            />
          </div>
          <Button className="mt-5" onClick={handleGenerate} disabled={generating} magnetic={false}>
            <Sparkles className="h-4 w-4" />
            {generating ? "Generating…" : studioFront ? "Regenerate all" : "Generate Sales Photos"}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <PhotoResultCard
          slotKey="studio_front"
          slotState={jobState?.photos.studio_front}
          image={studioFront}
          referenceUrl={front?.secureUrl}
          onRegenerate={(instruction) => handleRegenerate("studio_front", instruction)}
          onDiscard={studioFront ? () => handleDiscard(studioFront) : undefined}
          onReplace={studioFront ? (f) => handleReplaceOwnPhoto(studioFront, f) : undefined}
          coverNode={coverControl(studioFront)}
        />
        <PhotoResultCard
          slotKey="studio_back"
          slotState={jobState?.photos.studio_back}
          image={studioBack}
          referenceUrl={back?.secureUrl}
          onRegenerate={(instruction) => handleRegenerate("studio_back", instruction)}
          onDiscard={studioBack ? () => handleDiscard(studioBack) : undefined}
          onReplace={studioBack ? (f) => handleReplaceOwnPhoto(studioBack, f) : undefined}
          coverNode={coverControl(studioBack)}
        />
        <PhotoResultCard
          slotKey="model_front"
          slotState={jobState?.photos.model_front}
          image={modelFront}
          referenceUrl={front?.secureUrl}
          onRegenerate={(instruction) => handleRegenerate("model_front", instruction)}
          onDiscard={modelFront ? () => handleDiscard(modelFront) : undefined}
          onReplace={modelFront ? (f) => handleReplaceOwnPhoto(modelFront, f) : undefined}
          coverNode={coverControl(modelFront)}
          aiModelLabel
        />
        <PhotoResultCard
          slotKey="lifestyle"
          slotState={jobState?.photos.lifestyle}
          image={lifestyle}
          referenceUrl={front?.secureUrl}
          onRegenerate={(instruction) => handleRegenerate("lifestyle", instruction)}
          onDiscard={lifestyle ? () => handleDiscard(lifestyle) : undefined}
          onReplace={lifestyle ? (f) => handleReplaceOwnPhoto(lifestyle, f) : undefined}
          coverNode={coverControl(lifestyle)}
          aiModelLabel
        />
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} magnetic={false}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!studioFront && !modelFront}>
          Continue to Pricing
        </Button>
      </div>
    </div>
  );
}

function emptyPhotos(): Record<Slot, PhotoSlotState> {
  return {
    studio_front: { status: "pending" },
    studio_back: { status: "pending" },
    model_front: { status: "pending" },
    lifestyle: { status: "pending" },
  };
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
  labels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium uppercase tracking-wider text-foreground/50">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </select>
    </div>
  );
}

function PhotoResultCard({
  slotKey,
  slotState,
  image,
  referenceUrl,
  onRegenerate,
  onDiscard,
  onReplace,
  coverNode,
  aiModelLabel,
}: {
  slotKey: Slot;
  slotState?: PhotoSlotState;
  image?: WizardImage;
  referenceUrl?: string;
  onRegenerate: (instruction?: string) => void;
  onDiscard?: () => void;
  onReplace?: (file: File) => void;
  coverNode?: React.ReactNode;
  aiModelLabel?: boolean;
}) {
  const [instruction, setInstruction] = React.useState("");
  const [showInstruction, setShowInstruction] = React.useState(false);
  const replaceInputRef = React.useRef<HTMLInputElement>(null);
  const status = slotState?.status;
  const isBusy = status === "generating" || status === "checking" || status === "regenerating";

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">{SLOT_LABELS[slotKey]}</p>
        {status && (
          <span className="flex items-center gap-1 text-xs text-foreground/50">
            {isBusy && <span className="h-2 w-2 animate-pulse rounded-full bg-sienna" />}
            {status === "checking" ? "Checking faithfulness…" : isBusy ? "Working…" : null}
          </span>
        )}
      </div>

      {image?.secureUrl && referenceUrl ? (
        <BeforeAfterSlider before={referenceUrl} after={image.secureUrl} />
      ) : image?.secureUrl ? (
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-foreground/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.secureUrl} alt={SLOT_LABELS[slotKey]} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-[3/4] items-center justify-center rounded-xl border-2 border-dashed border-border text-xs text-foreground/40">
          {isBusy ? "Generating…" : "Not generated yet"}
        </div>
      )}

      {aiModelLabel && image && (
        <span className="mt-2 inline-block rounded-full bg-ink/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/50">
          Visualized on AI model
        </span>
      )}

      {coverNode}

      {image?.faithfulnessFlag && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" /> Mismatch flagged — this photo doesn&rsquo;t faithfully match the
          original garment. Regenerate or discard before publishing.
        </p>
      )}
      {image && !image.faithfulnessFlag && slotKey !== "studio_front" && slotKey !== "studio_back" && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-sage-dark)]">
          <CheckCircle2 className="h-3.5 w-3.5" /> Faithfulness check passed
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" magnetic={false} disabled={isBusy} onClick={() => setShowInstruction((v) => !v)}>
          <RotateCcw className="h-3.5 w-3.5" /> Regenerate
        </Button>
        {onDiscard && (
          <Button size="sm" variant="ghost" magnetic={false} disabled={isBusy} onClick={onDiscard}>
            <Trash2 className="h-3.5 w-3.5" /> Discard
          </Button>
        )}
        {onReplace && (
          <>
            <Button size="sm" variant="ghost" magnetic={false} disabled={isBusy} onClick={() => replaceInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Replace with own photo
            </Button>
            <input
              ref={replaceInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onReplace(e.target.files[0])}
            />
          </>
        )}
      </div>

      {showInstruction && (
        <div className="mt-2 flex gap-2">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Custom instruction (optional)"
            className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-xs"
          />
          <Button
            size="sm"
            magnetic={false}
            onClick={() => {
              onRegenerate(instruction || undefined);
              setShowInstruction(false);
              setInstruction("");
            }}
          >
            Go
          </Button>
        </div>
      )}
    </div>
  );
}
