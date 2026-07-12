"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Category {
  _id: string;
  name: string;
  slug: string;
}

const SIZES = ["XS", "S", "M", "L", "XL", "4", "5", "6", "7", "8", "9", "10", "11", "30", "32", "34", "36"];
const COLORS = [
  { name: "Black", hex: "#1B1B1B" },
  { name: "White", hex: "#F7F5F0" },
  { name: "Ivory", hex: "#FAF7F2" },
  { name: "Charcoal", hex: "#3A3A3A" },
  { name: "Sienna", hex: "#C15B3C" },
  { name: "Sage", hex: "#8A9A7E" },
  { name: "Tan", hex: "#B08463" },
  { name: "Navy", hex: "#2C3E66" },
];

export interface ShopFilters {
  category: string | null;
  sizes: string[];
  colors: string[];
  minPrice: string;
  maxPrice: string;
}

export function FilterSidebar({ filters, onChange }: { filters: ShopFilters; onChange: (f: ShopFilters) => void }) {
  const [categories, setCategories] = React.useState<Category[]>([]);

  React.useEffect(() => {
    apiFetch<{ categories: Category[] }>("/api/categories").then((data) => setCategories(data.categories));
  }, []);

  function toggle(list: string[], value: string) {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  return (
    <aside className="w-full shrink-0 space-y-8 sm:w-56">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">Category</p>
        <div className="mt-3 space-y-2">
          <button
            onClick={() => onChange({ ...filters, category: null })}
            className={cn("block text-sm", !filters.category ? "text-accent" : "text-foreground/70")}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c._id}
              onClick={() => onChange({ ...filters, category: c.slug })}
              className={cn("block text-sm", filters.category === c.slug ? "text-accent" : "text-foreground/70")}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">Size</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => onChange({ ...filters, sizes: toggle(filters.sizes, s) })}
              className={cn(
                "h-8 min-w-8 rounded-full border px-2 text-xs",
                filters.sizes.includes(s) ? "border-ink bg-ink text-ivory dark:border-ivory dark:bg-ivory dark:text-ink" : "border-border"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">Color</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c.name}
              onClick={() => onChange({ ...filters, colors: toggle(filters.colors, c.name) })}
              title={c.name}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-transform",
                filters.colors.includes(c.name) ? "scale-110 border-accent" : "border-border"
              )}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">Price (₹)</p>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.minPrice}
            onChange={(e) => onChange({ ...filters, minPrice: e.target.value })}
            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs"
          />
          <span className="text-foreground/40">–</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.maxPrice}
            onChange={(e) => onChange({ ...filters, maxPrice: e.target.value })}
            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs"
          />
        </div>
      </div>
    </aside>
  );
}
