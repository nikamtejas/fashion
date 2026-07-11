// Pure pricing calculator per SPEC.md §4.2. Percent fields (marginPct, gstRateLow,
// gstRateHigh) are stored and passed as whole-number percentages (e.g. 5 = 5%).
//
//   Base Cost      = Purchase Price + Fixed Cost
//   Margin Amount  = Base Cost x Margin %
//   Pre-tax Price  = Base Cost + Margin Amount
//   GST Rate       = gstRateHigh if Pre-tax Price >= gstThreshold else gstRateLow
//   GST Amount     = Pre-tax Price x GST Rate
//   Final Price    = Pre-tax Price + GST Amount
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
