"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Coupon, CouponInput } from "@/lib/coupons";
import { ApiRequestError } from "@/lib/api";

function toDateInputValue(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function CouponForm({
  initial,
  onSubmit,
}: {
  initial?: Coupon;
  onSubmit: (input: CouponInput) => Promise<void>;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initial?.code ?? "");
  const [type, setType] = useState<"flat" | "percentage">(initial?.type ?? "percentage");
  const [value, setValue] = useState(String(initial?.value ?? ""));
  const [maxDiscount, setMaxDiscount] = useState(
    initial?.maxDiscount !== undefined ? String(initial.maxDiscount) : ""
  );
  const [minCartValue, setMinCartValue] = useState(String(initial?.minCartValue ?? 0));
  const [expiresAt, setExpiresAt] = useState(toDateInputValue(initial?.expiresAt));
  const [usageLimit, setUsageLimit] = useState(
    initial?.usageLimit !== undefined ? String(initial.usageLimit) : ""
  );
  const [applicableCategories, setApplicableCategories] = useState(
    initial?.applicableCategories.join(", ") ?? ""
  );
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const input: CouponInput = {
        code: code.trim().toUpperCase(),
        type,
        value: Number(value) || 0,
        maxDiscount: maxDiscount.trim() ? Number(maxDiscount) : undefined,
        minCartValue: Number(minCartValue) || 0,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        usageLimit: usageLimit.trim() ? Number(usageLimit) : undefined,
        applicableCategories: applicableCategories
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        active,
      };
      await onSubmit(input);
      router.push("/coupons");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Code
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          placeholder="SUMMER20"
          className="h-11 rounded-lg border border-black/15 bg-transparent px-3 text-sm uppercase outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Type
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "flat" | "percentage")}
          className="h-11 rounded-lg border border-black/15 bg-transparent px-3 text-sm dark:border-white/20"
        >
          <option value="percentage">Percentage off</option>
          <option value="flat">Flat amount off</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {type === "percentage" ? "Value (%)" : "Value (₹)"}
        <input
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          className="h-11 rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
        />
      </label>

      {type === "percentage" && (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Max discount (₹, optional)
          <input
            type="number"
            min={0}
            step="0.01"
            value={maxDiscount}
            onChange={(e) => setMaxDiscount(e.target.value)}
            placeholder="No cap"
            className="h-11 rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Minimum cart value (₹)
        <input
          type="number"
          min={0}
          step="0.01"
          value={minCartValue}
          onChange={(e) => setMinCartValue(e.target.value)}
          className="h-11 rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Expires on (optional)
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="h-11 rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Total usage limit (optional)
        <input
          type="number"
          min={0}
          value={usageLimit}
          onChange={(e) => setUsageLimit(e.target.value)}
          placeholder="Unlimited"
          className="h-11 rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
        />
        {initial && (
          <span className="text-xs font-normal text-black/50 dark:text-white/50">
            Used {initial.usedCount} time{initial.usedCount === 1 ? "" : "s"} so far.
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Applicable categories (comma-separated, optional)
        <input
          value={applicableCategories}
          onChange={(e) => setApplicableCategories(e.target.value)}
          placeholder="Leave blank to apply to every category"
          className="h-11 rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-11 w-fit rounded-full bg-black px-6 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {isSubmitting ? "Saving…" : initial ? "Save changes" : "Create coupon"}
      </button>
    </form>
  );
}
