"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { WizardProduct } from "./types";

function computePreview(purchasePrice: number, marginPct: number, fixedCost: number, mrp: number) {
  const marginAmount = Math.round(purchasePrice * (marginPct / 100));
  const baseCost = purchasePrice + marginAmount + fixedCost;
  const gstRate = baseCost <= 1000 ? 5 : 12;
  const gstAmount = Math.round(baseCost * (gstRate / 100));
  const finalPrice = baseCost + gstAmount;
  const profitPerUnit = finalPrice - gstAmount - purchasePrice - fixedCost;
  const effectiveMarginPct = finalPrice > 0 ? Math.round((profitPerUnit / finalPrice) * 100) : 0;
  return { marginAmount, baseCost, gstRate, gstAmount, finalPrice, profitPerUnit, effectiveMarginPct, mrp };
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
  const [purchasePrice, setPurchasePrice] = React.useState(product.pricing?.purchasePrice || 0);
  const [marginPct, setMarginPct] = React.useState(product.pricing?.marginValue || 30);
  const [fixedCost, setFixedCost] = React.useState(product.pricing?.fixedCosts?.[0]?.value || 0);
  const [mrp, setMrp] = React.useState(product.pricing?.mrp || 0);
  const [saving, setSaving] = React.useState(false);

  const preview = computePreview(purchasePrice, marginPct, fixedCost, mrp);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await apiFetch<{ product: WizardProduct }>(`/api/admin/products/${product._id}`, {
        method: "PATCH",
        json: {
          pricing: { purchasePrice, marginType: "PERCENTAGE", marginValue: marginPct, fixedCost, mrp: mrp || undefined },
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
    <form onSubmit={handleSubmit} className="grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-2">
      <div className="space-y-4">
        <Input
          label="Purchase price (₹)"
          type="number"
          min={0}
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(Number(e.target.value))}
        />
        <Input label="Margin (%)" type="number" min={0} value={marginPct} onChange={(e) => setMarginPct(Number(e.target.value))} />
        <Input
          label="Fixed costs — packaging, logistics (₹)"
          type="number"
          min={0}
          value={fixedCost}
          onChange={(e) => setFixedCost(Number(e.target.value))}
        />
        <Input
          label="MRP / compare-at price (₹, optional)"
          type="number"
          min={0}
          value={mrp}
          onChange={(e) => setMrp(Number(e.target.value))}
        />
        <p className="text-xs text-foreground/50">
          The full GST-slab calculator with inclusive/exclusive toggle and custom parameter rows arrives in Milestone 3.
          This gives a working price for now, using the standard ₹1,000 apparel GST threshold (5% at/below, 12% above).
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Live breakdown</p>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Purchase price" value={purchasePrice} />
          <Row label={`Margin (${marginPct}%)`} value={preview.marginAmount} />
          <Row label="Fixed costs" value={fixedCost} />
          <Row label="Base cost" value={preview.baseCost} bold />
          <Row label={`GST (${preview.gstRate}%)`} value={preview.gstAmount} />
        </dl>
        <div className="my-4 h-px bg-border" />
        <motion.p key={preview.finalPrice} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="font-display text-3xl">
          ₹{preview.finalPrice.toLocaleString("en-IN")}
        </motion.p>
        {mrp > preview.finalPrice && (
          <p className="text-sm text-foreground/50">
            <span className="line-through">₹{mrp.toLocaleString("en-IN")}</span>{" "}
            <span className="text-sienna">{Math.round((1 - preview.finalPrice / mrp) * 100)}% off</span>
          </p>
        )}
        <p className="mt-3 text-xs text-foreground/50">
          Effective margin {preview.effectiveMarginPct}% · Profit ₹{preview.profitPerUnit.toLocaleString("en-IN")}/unit
        </p>
      </div>

      <div className="flex gap-3 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onBack} magnetic={false}>
          Back
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Continue to Review"}
        </Button>
      </div>
    </form>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-medium" : "text-foreground/60"}`}>
      <dt>{label}</dt>
      <dd>₹{value.toLocaleString("en-IN")}</dd>
    </div>
  );
}
