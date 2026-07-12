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
  const [colorsInput, setColorsInput] = React.useState(
    [...new Set(product.variants.map((v) => v.color))].join(", ") || "Black"
  );
  const [variants, setVariants] = React.useState<WizardVariant[]>(product.variants);
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);

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
      const data = await apiFetch<{ product: WizardProduct }>(`/api/admin/products/${product._id}`, {
        method: "PATCH",
        json: { variants },
      });
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
              <Image src={img.secureUrl} alt="" fill className="object-cover" />
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
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Input label="Sizes (comma-separated)" value={sizesInput} onChange={(e) => setSizesInput(e.target.value)} />
          <Input label="Colors (comma-separated)" value={colorsInput} onChange={(e) => setColorsInput(e.target.value)} />
        </div>
        <Button type="button" size="sm" variant="outline" className="mt-3" magnetic={false} onClick={generateVariants}>
          Generate variant rows
        </Button>

        {variants.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
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
                    <td className="px-3 py-2">{v.color}</td>
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
        <Button type="button" variant="outline" onClick={onBack} magnetic={false}>
          Back
        </Button>
        <Button type="button" disabled={publishing || flaggedImages.length > 0} onClick={handlePublish}>
          {publishing ? "Publishing…" : "Publish product"}
        </Button>
      </div>
    </div>
  );
}
