// Mirrors backend/src/utils/pricing.ts exactly, for an instant client-side preview
// as the admin types. The backend always recomputes authoritatively on submit — this
// copy is UX-only and is never trusted as the source of truth.
export interface PricingInput {
  purchasePrice: number;
  fixedCost: number;
  marginPct: number;
  gstThreshold: number;
  gstRateLow: number;
  gstRateHigh: number;
}

export interface PricingBreakdown extends PricingInput {
  baseCost: number;
  marginAmount: number;
  preTaxPrice: number;
  gstRate: number;
  gstAmount: number;
  finalPrice: number;
}

export function computePricing(input: PricingInput): PricingBreakdown {
  const baseCost = input.purchasePrice + input.fixedCost;
  const marginAmount = baseCost * (input.marginPct / 100);
  const preTaxPrice = baseCost + marginAmount;
  const gstRate = preTaxPrice >= input.gstThreshold ? input.gstRateHigh : input.gstRateLow;
  const gstAmount = preTaxPrice * (gstRate / 100);
  const finalPrice = preTaxPrice + gstAmount;

  return { ...input, baseCost, marginAmount, preTaxPrice, gstRate, gstAmount, finalPrice };
}
