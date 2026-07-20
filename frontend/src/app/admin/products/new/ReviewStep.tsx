"use client";

import * as React from "react";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import type { WizardProduct, WizardVariant } from "./types";

function slugifyToken(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

// Common fashion color names auto-resolve to a real hex without the admin
// having to touch the color picker — typing "Black, White" alone used to
// leave colorHex unset (the picker's on-screen "#000000" default was never
// actually written to state until clicked), so every swatch fell back to
// the same gray placeholder regardless of the names typed.
const NAMED_COLOR_HEX: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  gray: "#808080",
  grey: "#808080",
  charcoal: "#36454f",
  navy: "#1a2744",
  blue: "#2563eb",
  "sky blue": "#38bdf8",
  denim: "#1560bd",
  red: "#dc2626",
  maroon: "#7f1d1d",
  burgundy: "#7f1d1d",
  wine: "#722f37",
  green: "#16a34a",
  olive: "#556b2f",
  sage: "#9caf88",
  mint: "#98ff98",
  khaki: "#c3b091",
  beige: "#e8dcc8",
  tan: "#d2b48c",
  camel: "#c19a6b",
  brown: "#78350f",
  rust: "#b7410e",
  cream: "#fdf6e3",
  ivory: "#fffff0",
  yellow: "#eab308",
  mustard: "#c9a227",
  gold: "#d4af37",
  orange: "#ea580c",
  peach: "#ffdab9",
  coral: "#ff7f50",
  pink: "#ec4899",
  "hot pink": "#ec4899",
  purple: "#7e22ce",
  lavender: "#c4b5fd",
  teal: "#0d9488",
  turquoise: "#14b8a6",
  silver: "#c0c0c0",
};

function resolveHex(color: string, override?: string): string | undefined {
  return override ?? NAMED_COLOR_HEX[color.trim().toLowerCase()];
}

export function ReviewStep({
  product,
  onProductChange,
  onPublish,
  onBack,
}: {
  product: WizardProduct;
  onProductChange: (p: WizardProduct) => void;
  onPublish: () => void;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [sizesInput, setSizesInput] = React.useState(
    [...new Set(product.variants.map((v) => v.size))].join(", ") || "S, M, L, XL"
  );
  // Pre-fills with colors already used in the Images step (front/back photos
  // uploaded per color there) as well as any existing variants — so a color
  // photographed earlier doesn't need to be retyped here to line up.
  const [colorsInput, setColorsInput] = React.useState(
    [...new Set([...product.variants.map((v) => v.color), ...product.images.flatMap((i) => (i.color ? [i.color] : []))])].join(
      ", "
    ) || "Black"
  );
  const [variants, setVariants] = React.useState<WizardVariant[]>(product.variants);
  // One hex value per color name — the source of truth for every swatch
  // preview (table rows, storefront). Keyed by name so it survives
  // regenerating variant rows and applies even without re-clicking Generate.
  const [colorHexInput, setColorHexInput] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(product.variants.filter((v) => v.colorHex).map((v) => [v.color, v.colorHex!]))
  );
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);

  const uniqueColors = [...new Set(colorsInput.split(",").map((c) => c.trim()).filter(Boolean))];

  function generateVariants() {
    const sizes = sizesInput.split(",").map((s) => s.trim()).filter(Boolean);
    const colors = colorsInput.split(",").map((c) => c.trim()).filter(Boolean);
    const next: WizardVariant[] = [];
    for (const size of sizes) {
      for (const color of colors) {
        const existing = variants.find((v) => v.size === size && v.color === color);
        next.push(
          existing ?? {
            size,
            color,
            colorHex: resolveHex(color, colorHexInput[color]),
            sku: `${slugifyToken(product.slug).slice(0, 12)}-${slugifyToken(size)}-${slugifyToken(color)}`,
            stock: 10,
          }
        );
      }
    }
    setVariants(next);
  }

  async function saveVariants() {
    setSaving(true);
    try {
      // Apply whatever hex is currently set per color, even if the rows
      // were generated before the color picker was touched.
      const withHex = variants.map((v) => ({ ...v, colorHex: resolveHex(v.color, colorHexInput[v.color]) ?? v.colorHex }));
      const data = await apiFetch<{ product: WizardProduct }>(`/api/admin/products/${product._id}`, {
        method: "PATCH",
        json: { variants: withHex },
      });
      setVariants(withHex);
      onProductChange(data.product);
      toast({ title: "Variants saved", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't save variants", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    await saveVariants();
    await onPublish();
    setPublishing(false);
  }

  const flaggedImages = product.images.filter((i) => i.faithfulnessFlag);
  const galleryImages = [...product.images]
    .filter((i) => i.type !== "ORIGINAL")
    .sort((a, b) => a.order - b.order);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="font-display text-lg">Gallery preview</h2>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {(galleryImages.length > 0 ? galleryImages : product.images).map((img) => (
            <div key={img._id} className="relative h-32 w-24 shrink-0 overflow-hidden rounded-lg bg-foreground/5">
              <Image src={img.secureUrl} alt="" fill sizes="96px" className="object-cover" />
              {img.color && (
                <span className="absolute bottom-1 left-1 rounded-full bg-ink/70 px-1.5 py-0.5 text-[9px] text-ivory">
                  {img.color}
                </span>
              )}
            </div>
          ))}
        </div>
        {flaggedImages.length > 0 && (
          <p className="mt-2 text-xs text-amber-600">
            {flaggedImages.length} photo(s) are flagged for a faithfulness mismatch — go back to Images to resolve
            before publishing.
          </p>
        )}
      </div>

      <div>
        <h2 className="font-display text-lg">Sizes & colors</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Sizes (comma-separated)" value={sizesInput} onChange={(e) => setSizesInput(e.target.value)} />
          <Input label="Colors (comma-separated)" value={colorsInput} onChange={(e) => setColorsInput(e.target.value)} />
        </div>

        {uniqueColors.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {uniqueColors.map((color) => (
              <label
                key={color}
                className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs"
              >
                <input
                  type="color"
                  value={resolveHex(color, colorHexInput[color]) ?? "#000000"}
                  onChange={(e) => setColorHexInput((s) => ({ ...s, [color]: e.target.value }))}
                  className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                {color}
              </label>
            ))}
          </div>
        )}

        <Button type="button" size="sm" variant="outline" className="mt-3" magnetic={false} onClick={generateVariants}>
          Generate variant rows
        </Button>

        {variants.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wider text-foreground/50">
                <tr>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Color</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Stock</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v, i) => (
                  <tr key={`${v.size}-${v.color}`} className="border-t border-border">
                    <td className="px-3 py-2">{v.size}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3.5 w-3.5 shrink-0 rounded-full border border-border"
                          style={{ backgroundColor: resolveHex(v.color, colorHexInput[v.color]) ?? v.colorHex ?? "#ccc" }}
                        />
                        {v.color}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-foreground/50">{v.sku}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={v.stock}
                        onChange={(e) => {
                          const next = [...variants];
                          next[i] = { ...v, stock: Number(e.target.value) };
                          setVariants(next);
                        }}
                        className="h-8 w-20 rounded-md border border-border bg-background px-2"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Button type="button" size="sm" className="mt-3" disabled={saving} magnetic={false} onClick={saveVariants}>
          {saving ? "Saving…" : "Save variants"}
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-display text-lg">{product.name}</h2>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="outline">{product.status}</Badge>
          <span className="text-sm text-foreground/60">₹{product.pricing?.finalPrice?.toLocaleString("en-IN")}</span>
        </div>
        <p className="mt-2 text-sm text-foreground/60">{product.description || "No description yet."}</p>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} magnetic={false} className="flex-1">
          Back
        </Button>
        <Button type="button" disabled={publishing || flaggedImages.length > 0} onClick={handlePublish} className="flex-1">
          {publishing ? "Publishing…" : "Publish product"}
        </Button>
      </div>
    </div>
  );
}
