"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  computePricing,
  solveMarginForTarget,
  GST_SLABS,
  type CostLine,
  type MarginType,
  type TaxType,
} from "@/lib/pricing";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { WizardProduct } from "./types";

function AnimatedAmount({ value, className }: { value: number; className?: string }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={value}
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -8, opacity: 0 }}
        transition={{ duration: 0.18 }}
        className={cn("inline-block tabular-nums", className)}
      >
        ₹{value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </motion.span>
    </AnimatePresence>
  );
}

function CostLineRows({
  label,
  addLabel,
  lines,
  onChange,
}: {
  label: string;
  addLabel: string;
  lines: CostLine[];
  onChange: (lines: CostLine[]) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-foreground/70">{label}</p>
      <div className="mt-2 space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={line.name}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...line, name: e.target.value };
                onChange(next);
              }}
              placeholder="Name (e.g. Packaging)"
              className="h-10 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
            />
            <input
              type="number"
              min={0}
              value={line.value || ""}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...line, value: Number(e.target.value) };
                onChange(next);
              }}
              placeholder="₹"
              className="h-10 w-24 rounded-lg border border-border bg-surface px-3 text-sm"
            />
            <button
              type="button"
              aria-label="Remove line"
              onClick={() => onChange(lines.filter((_, j) => j !== i))}
              className="rounded-lg p-2 text-foreground/40 hover:bg-foreground/5 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...lines, { name: "", value: 0 }])}
        className="mt-2 flex items-center gap-1 text-xs text-accent hover:underline"
      >
        <Plus className="h-3 w-3" /> {addLabel}
      </button>
    </div>
  );
}

export function PricingStep({
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
  const p = product.pricing;

  const [purchasePrice, setPurchasePrice] = React.useState(p?.purchasePrice || 0);
  const [marginType, setMarginType] = React.useState<MarginType>(p?.marginType ?? "PERCENTAGE");
  const [marginValue, setMarginValue] = React.useState(p?.marginValue || 30);
  const [fixedCosts, setFixedCosts] = React.useState<CostLine[]>(
    p?.fixedCosts?.length ? p.fixedCosts : [{ name: "Packaging", value: 0 }]
  );
  const [customParams, setCustomParams] = React.useState<CostLine[]>(p?.customParams ?? []);
  const [gstOverride, setGstOverride] = React.useState<number | undefined>(
    p?.gstRate && p.gstRate !== p.suggestedGstRate ? p.gstRate : undefined
  );
  const [gstInclusive, setGstInclusive] = React.useState(p?.gstInclusive ?? false);
  const [taxType, setTaxType] = React.useState<TaxType>(p?.taxType ?? "CGST_SGST");
  const [mrp, setMrp] = React.useState(p?.mrp || 0);
  const [saving, setSaving] = React.useState(false);

  const input = {
    purchasePrice,
    marginType,
    marginValue,
    fixedCosts,
    customParams,
    gstRate: gstOverride,
    gstInclusive,
    taxType,
    mrp: mrp || undefined,
  };
  const b = computePricing(input);

  // ₹999-style round-off candidates around the current final price.
  const roundOffTargets = React.useMemo(() => {
    if (b.finalPrice <= 0) return [];
    const below = Math.ceil(b.finalPrice / 100) * 100 - 101; // e.g. 1299.2 → 1199
    const near = Math.ceil(b.finalPrice / 100) * 100 - 1; // e.g. 1299.2 → 1299
    const above = near + 100; // e.g. → 1399
    return [...new Set([below, near, above])].filter((t) => t > 0);
  }, [b.finalPrice]);

  function applyRoundOff(target: number) {
    const solved = solveMarginForTarget(target, {
      purchasePrice,
      marginType,
      fixedCosts,
      customParams,
      gstRate: gstOverride,
      gstInclusive,
      taxType,
    });
    if (solved === null) {
      toast({ title: "Not reachable", description: `₹${target} would need a negative margin.`, variant: "error" });
      return;
    }
    setMarginValue(solved);
    toast({
      title: `Priced at ₹${target.toLocaleString("en-IN")}`,
      description: `Margin back-solved to ${marginType === "PERCENTAGE" ? `${solved}%` : `₹${solved}`}.`,
      variant: "success",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await apiFetch<{ product: WizardProduct }>(`/api/admin/products/${product._id}`, {
        method: "PATCH",
        json: {
          pricing: {
            purchasePrice,
            marginType,
            marginValue,
            fixedCosts: fixedCosts.filter((l) => l.name.trim() || l.value),
            customParams: customParams.filter((l) => l.name.trim() || l.value),
            gstRate: gstOverride,
            gstInclusive,
            taxType,
            mrp: mrp || undefined,
          },
        },
      });
      onProductChange(data.product);
      onNext();
    } catch (err) {
      toast({ title: "Couldn't save pricing", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-4xl grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Input
          label="Purchase price (₹)"
          type="number"
          min={0}
          step="0.01"
          value={purchasePrice || ""}
          onChange={(e) => setPurchasePrice(Number(e.target.value))}
        />

        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-foreground/70">Margin</p>
          <div className="mt-2 flex gap-2">
            <div className="inline-flex rounded-full border border-border p-0.5">
              {(["PERCENTAGE", "FLAT"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMarginType(t)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium",
                    marginType === t ? "bg-ink text-ivory dark:bg-ivory dark:text-ink" : "text-foreground/60"
                  )}
                >
                  {t === "PERCENTAGE" ? "%" : "₹ flat"}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={0}
              step="0.01"
              value={marginValue || ""}
              onChange={(e) => setMarginValue(Number(e.target.value))}
              className="h-10 w-28 rounded-lg border border-border bg-surface px-3 text-sm"
            />
            <span className="self-center text-xs text-foreground/50">
              = <AnimatedAmount value={b.marginAmount} />
            </span>
          </div>
        </div>

        <CostLineRows label="Fixed costs" addLabel="Add fixed cost" lines={fixedCosts} onChange={setFixedCosts} />
        <CostLineRows
          label="Custom parameters"
          addLabel="Add parameter (platform fee, handling…)"
          lines={customParams}
          onChange={setCustomParams}
        />

        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-foreground/70">GST</p>
            <p className="text-xs text-foreground/50">
              Suggested for ₹{b.baseCost.toLocaleString("en-IN")}:{" "}
              <span className="font-semibold text-accent">{b.suggestedGstRate}%</span>
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setGstOverride(undefined)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                gstOverride === undefined ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground/60"
              )}
            >
              Auto ({b.suggestedGstRate}%)
            </button>
            {GST_SLABS.map((slab) => (
              <button
                key={slab}
                type="button"
                onClick={() => setGstOverride(slab)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  gstOverride === slab ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground/60"
                )}
              >
                {slab}%
              </button>
            ))}
            <span className="text-[10px] text-foreground/40">5/12/18% selectable for footwear & accessories</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={gstInclusive} onChange={(e) => setGstInclusive(e.target.checked)} />
              Price is GST-inclusive
            </label>
            <div className="inline-flex rounded-full border border-border p-0.5">
              {(
                [
                  ["CGST_SGST", "CGST + SGST (intra-state)"],
                  ["IGST", "IGST (inter-state)"],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTaxType(t)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium",
                    taxType === t ? "bg-ink text-ivory dark:bg-ivory dark:text-ink" : "text-foreground/60"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Input
          label="MRP / compare-at price (₹, optional)"
          type="number"
          min={0}
          value={mrp || ""}
          onChange={(e) => setMrp(Number(e.target.value))}
        />

        {roundOffTargets.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-foreground/70">
              <Sparkles className="h-3.5 w-3.5 text-sienna" /> Psychological pricing
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {roundOffTargets.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => applyRoundOff(t)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-accent hover:text-accent"
                >
                  ₹{t.toLocaleString("en-IN")}
                </button>
              ))}
              <span className="self-center text-[10px] text-foreground/40">back-solves the margin</span>
            </div>
          </div>
        )}
      </div>

      <div className="h-fit rounded-2xl border border-border bg-surface p-6 lg:sticky lg:top-24">
        <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Itemized breakdown</p>
        <dl className="mt-4 space-y-1.5 text-sm">
          <Row label="Purchase price">
            <AnimatedAmount value={b.purchasePrice} />
          </Row>
          <Row label={marginType === "PERCENTAGE" ? `Margin (${b.marginValue}%)` : "Margin (flat)"}>
            <AnimatedAmount value={b.marginAmount} />
          </Row>
          {b.fixedCosts.map((l, i) => (
            <Row key={`f-${i}`} label={l.name || "Fixed cost"} muted>
              <AnimatedAmount value={l.value} />
            </Row>
          ))}
          {b.customParams.map((l, i) => (
            <Row key={`c-${i}`} label={l.name || "Parameter"} muted>
              <AnimatedAmount value={l.value} />
            </Row>
          ))}
          <div className="!my-3 h-px bg-border" />
          <Row label={`Base price${gstInclusive ? " (incl. GST)" : ""}`} bold>
            <AnimatedAmount value={b.baseCost} />
          </Row>
          <Row label={`GST @ ${b.gstRate}%${gstInclusive ? " (within)" : ""}`}>
            <AnimatedAmount value={b.gstAmount} />
          </Row>
          {taxType === "CGST_SGST" ? (
            <>
              <Row label={`— CGST (${b.gstRate / 2}%)`} muted>
                <AnimatedAmount value={b.cgst} />
              </Row>
              <Row label={`— SGST (${b.gstRate / 2}%)`} muted>
                <AnimatedAmount value={b.sgst} />
              </Row>
            </>
          ) : (
            <Row label={`— IGST (${b.gstRate}%)`} muted>
              <AnimatedAmount value={b.igst} />
            </Row>
          )}
        </dl>

        <div className="my-4 h-px bg-border" />
        <p className="text-xs uppercase tracking-wider text-foreground/50">Final selling price</p>
        <AnimatedAmount value={b.finalPrice} className="font-display mt-1 text-4xl" />

        {b.discountPct !== undefined && b.mrp && (
          <p className="mt-1 text-sm text-foreground/50">
            <span className="line-through">₹{b.mrp.toLocaleString("en-IN")}</span>{" "}
            <span className="font-medium text-sienna">{b.discountPct}% off</span>
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-background p-3">
            <p className="text-[10px] uppercase tracking-wider text-foreground/50">Effective margin</p>
            <p className="mt-1 font-medium tabular-nums">{b.marginPct}%</p>
          </div>
          <div className="rounded-xl bg-background p-3">
            <p className="text-[10px] uppercase tracking-wider text-foreground/50">Profit / unit</p>
            <AnimatedAmount value={b.profitPerUnit} className="mt-1 font-medium" />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} magnetic={false} className="flex-1">
            Back
          </Button>
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? "Saving…" : "Save & continue"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Row({
  label,
  children,
  bold,
  muted,
}: {
  label: string;
  children: React.ReactNode;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={cn("flex justify-between", bold ? "font-medium" : muted ? "pl-3 text-foreground/45" : "text-foreground/65")}>
      <dt className="truncate pr-4">{label}</dt>
      <dd className="shrink-0">{children}</dd>
    </div>
  );
}
