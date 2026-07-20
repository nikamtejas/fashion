"use client";

import * as React from "react";
import { apiFetch, cachedApiFetch } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SHOP_SUBCATEGORIES } from "@/lib/shopCategories";
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
  // The exact slug the storefront's Shirts/T-Shirts type filter matches
  // against (see SHOP_SUBCATEGORIES) — kept separate from free-text tags so
  // it's never mistyped or wrong-cased.
  const [type, setType] = React.useState("");
  const [description, setDescription] = React.useState(product?.description ?? "");
  const [saving, setSaving] = React.useState(false);

  const categorySlug = categories.find((c) => c._id === category)?.slug;
  const typeOptions = categorySlug ? SHOP_SUBCATEGORIES[categorySlug] : undefined;

  React.useEffect(() => {
    cachedApiFetch<{ categories: Category[] }>("/api/categories").then((data) => {
      setCategories(data.categories);
      const currentCategoryId = category || data.categories[0]?._id;
      if (!category && data.categories[0]) setCategory(data.categories[0]._id);

      const slug = data.categories.find((c) => c._id === currentCategoryId)?.slug;
      const options = slug ? SHOP_SUBCATEGORIES[slug] : undefined;
      const existing = options?.find((o) => product?.tags?.some((t) => t.toLowerCase() === o.value))?.value;
      if (existing) {
        setType(existing);
        // Drop it from the free-text field so it isn't shown twice.
        setTags((prev) =>
          prev
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.toLowerCase() !== existing)
            .join(", ")
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const freeTags = tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const allTags = [...(type ? [type] : []), ...freeTags].filter((t, i, arr) => arr.indexOf(t) === i);
      const payload = {
        name,
        category,
        gender,
        brand,
        tags: allTags,
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
          onChange={(e) => {
            const newId = e.target.value;
            setCategory(newId);
            const slug = categories.find((c) => c._id === newId)?.slug;
            const options = slug ? SHOP_SUBCATEGORIES[slug] : undefined;
            if (!options?.some((o) => o.value === type)) setType("");
          }}
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

      {typeOptions && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-foreground/70">
            Type <span className="normal-case text-foreground/40">(powers the shop&rsquo;s Shirts/T-Shirts filter)</span>
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-12 rounded-lg border border-border bg-surface px-4 text-sm"
          >
            <option value="">— None —</option>
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <Input label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
      <Input
        label="Other tags (comma-separated)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />

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
