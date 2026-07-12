"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { WizardProduct } from "./types";

interface Category {
  _id: string;
  name: string;
  slug: string;
}

export function DetailsStep({
  product,
  onSaved,
  onNext,
}: {
  product: WizardProduct | null;
  onSaved: (p: WizardProduct) => void;
  onNext: () => void;
}) {
  const { toast } = useToast();
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [name, setName] = React.useState(product?.name ?? "");
  const [category, setCategory] = React.useState(
    typeof product?.category === "object" ? product.category._id : (product?.category ?? "")
  );
  const [gender, setGender] = React.useState(product?.gender ?? "UNISEX");
  const [brand, setBrand] = React.useState(product?.brand ?? "LuxeLoom");
  const [tags, setTags] = React.useState(product?.tags?.join(", ") ?? "");
  const [description, setDescription] = React.useState(product?.description ?? "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    apiFetch<{ categories: Category[] }>("/api/categories").then((data) => {
      setCategories(data.categories);
      if (!category && data.categories[0]) setCategory(data.categories[0]._id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        category,
        gender,
        brand,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        description,
      };
      const data = product
        ? await apiFetch<{ product: WizardProduct }>(`/api/admin/products/${product._id}`, { method: "PATCH", json: payload })
        : await apiFetch<{ product: WizardProduct }>("/api/admin/products", { method: "POST", json: payload });

      onSaved(data.product);
      onNext();
    } catch (err) {
      toast({ title: "Couldn't save details", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      <Input label="Product name" required value={name} onChange={(e) => setName(e.target.value)} />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wider text-foreground/70">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          className="h-12 rounded-lg border border-border bg-surface px-4 text-sm"
        >
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wider text-foreground/70">Gender</label>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value as typeof gender)}
          className="h-12 rounded-lg border border-border bg-surface px-4 text-sm"
        >
          <option value="MEN">Men</option>
          <option value="WOMEN">Women</option>
          <option value="UNISEX">Unisex</option>
        </select>
      </div>

      <Input label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
      <Input label="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wider text-foreground/70">
          Description <span className="normal-case text-foreground/40">(leave blank — AI drafts one from the photos)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="rounded-lg border border-border bg-surface px-4 py-3 text-sm"
        />
      </div>

      <Button type="submit" size="lg" disabled={saving}>
        {saving ? "Saving…" : "Continue to Images"}
      </Button>
    </form>
  );
}
