"use client";

import { computePricing, type PricingInput } from "@/lib/pricing";

export function PricingCalculator({
  value,
  onChange,
}: {
  value: PricingInput;
  onChange: (next: PricingInput) => void;
}) {
  const breakdown = computePricing(value);

  function set(key: keyof PricingInput, raw: string) {
    onChange({ ...value, [key]: Number(raw) || 0 });
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div className="flex flex-col gap-3">
        <Field label="Purchase price (₹)" value={value.purchasePrice} onChange={(v) => set("purchasePrice", v)} />
        <Field label="Fixed cost (₹)" value={value.fixedCost} onChange={(v) => set("fixedCost", v)} />
        <Field label="Margin (%)" value={value.marginPct} onChange={(v) => set("marginPct", v)} />
        <Field label="GST threshold (₹)" value={value.gstThreshold} onChange={(v) => set("gstThreshold", v)} />
        <Field
          label="GST rate below threshold (%)"
          value={value.gstRateLow}
          onChange={(v) => set("gstRateLow", v)}
        />
        <Field
          label="GST rate at/above threshold (%)"
          value={value.gstRateHigh}
          onChange={(v) => set("gstRateHigh", v)}
        />
      </div>

      <div className="h-fit rounded-xl border border-black/10 p-4 text-sm dark:border-white/10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Live breakdown
        </p>
        <Row label="Base cost" value={breakdown.baseCost} />
        <Row label={`Margin (${value.marginPct || 0}%)`} value={breakdown.marginAmount} />
        <Row label="Pre-tax price" value={breakdown.preTaxPrice} emphasis />
        <Row label={`GST applied (${breakdown.gstRate}%)`} value={breakdown.gstAmount} />
        <div className="my-2 border-t border-black/10 dark:border-white/10" />
        <Row label="Final price" value={breakdown.finalPrice} emphasis large />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
      />
    </label>
  );
}

function Row({
  label,
  value,
  emphasis,
  large,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  large?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1 ${
        emphasis ? "font-medium" : "text-black/70 dark:text-white/70"
      }`}
    >
      <span className={large ? "text-base" : ""}>{label}</span>
      <span className={large ? "text-base" : ""}>₹{value.toFixed(2)}</span>
    </div>
  );
}
