export interface SimplePricingInput {
  purchasePrice: number;
  marginType: "PERCENTAGE" | "FLAT";
  marginValue: number;
  fixedCost: number;
  mrp?: number;
}

/**
 * Minimal pricing computation for the M2 product wizard's Pricing step.
 * Milestone 3 replaces this with the full calculator (custom parameter
 * rows, GST-inclusive/exclusive toggle, CGST/SGST vs IGST, psychological
 * pricing) — the Product.pricing schema already has room for that.
 */
export function computeSimplePricing(input: SimplePricingInput) {
  const marginAmount =
    input.marginType === "PERCENTAGE" ? Math.round(input.purchasePrice * (input.marginValue / 100)) : input.marginValue;

  const baseCost = input.purchasePrice + marginAmount + input.fixedCost;
  const gstRate = baseCost <= 1000 ? 5 : 12;
  const gstAmount = Math.round(baseCost * (gstRate / 100));
  const finalPrice = baseCost + gstAmount;
  const profitPerUnit = finalPrice - gstAmount - input.purchasePrice - input.fixedCost;
  const marginPct = finalPrice > 0 ? Math.round((profitPerUnit / finalPrice) * 100) : 0;

  return {
    purchasePrice: input.purchasePrice,
    marginType: input.marginType,
    marginValue: input.marginValue,
    fixedCosts: input.fixedCost ? [{ name: "Fixed costs", value: input.fixedCost }] : [],
    customParams: [],
    baseCost,
    gstInclusive: false,
    gstRate,
    gstAmount,
    taxType: "CGST_SGST" as const,
    mrp: input.mrp,
    finalPrice,
    marginPct,
    profitPerUnit,
  };
}
