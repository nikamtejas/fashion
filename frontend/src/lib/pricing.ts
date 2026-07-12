/**
 * Client-side mirror of the backend pricing engine, used only for the live
 * preview panel in the admin wizard. The backend's computePricing()
 * (backend/src/lib/pricing.ts) is the single authority — it recomputes the
 * breakdown on save and this file must stay logic-identical to it. The
 * backend's unit tests are the contract for both.
 */

export type MarginType = "PERCENTAGE" | "FLAT";
export type TaxType = "CGST_SGST" | "IGST";

export interface CostLine {
  name: string;
  value: number;
}

export interface PricingInput {
  purchasePrice: number;
  marginType: MarginType;
  marginValue: number;
  fixedCosts?: CostLine[];
  customParams?: CostLine[];
  gstRate?: number;
  gstInclusive?: boolean;
  taxType?: TaxType;
  mrp?: number;
}

export interface PricingBreakdown {
  purchasePrice: number;
  marginType: MarginType;
  marginValue: number;
  marginAmount: number;
  fixedCosts: CostLine[];
  fixedCostsTotal: number;
  customParams: CostLine[];
  customParamsTotal: number;
  baseCost: number;
  suggestedGstRate: number;
  gstRate: number;
  gstInclusive: boolean;
  gstAmount: number;
  taxType: TaxType;
  cgst: number;
  sgst: number;
  igst: number;
  preTaxPrice: number;
  finalPrice: number;
  mrp?: number;
  discountPct?: number;
  marginPct: number;
  profitPerUnit: number;
}

export const GST_SLABS = [5, 12, 18] as const;
export const GST_SLAB_THRESHOLD = 1000;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function suggestGstRate(basePrice: number): number {
  return basePrice <= GST_SLAB_THRESHOLD ? 5 : 12;
}

function sumLines(lines: CostLine[] | undefined): number {
  return round2((lines ?? []).reduce((sum, l) => sum + (Number(l.value) || 0), 0));
}

export function computePricing(input: PricingInput): PricingBreakdown {
  const purchasePrice = round2(Number(input.purchasePrice) || 0);
  const marginValue = round2(Number(input.marginValue) || 0);
  const fixedCosts = (input.fixedCosts ?? []).filter((l) => l.name.trim() !== "" || l.value !== 0);
  const customParams = (input.customParams ?? []).filter((l) => l.name.trim() !== "" || l.value !== 0);

  const marginAmount =
    input.marginType === "PERCENTAGE" ? round2(purchasePrice * (marginValue / 100)) : marginValue;

  const fixedCostsTotal = sumLines(fixedCosts);
  const customParamsTotal = sumLines(customParams);

  const baseCost = round2(purchasePrice + marginAmount + fixedCostsTotal + customParamsTotal);

  const suggestedGstRate = suggestGstRate(baseCost);
  const gstRate = input.gstRate ?? suggestedGstRate;
  const gstInclusive = input.gstInclusive ?? false;
  const taxType = input.taxType ?? "CGST_SGST";

  let gstAmount: number;
  let preTaxPrice: number;
  let finalPrice: number;

  if (gstInclusive) {
    finalPrice = baseCost;
    gstAmount = round2((baseCost * gstRate) / (100 + gstRate));
    preTaxPrice = round2(baseCost - gstAmount);
  } else {
    preTaxPrice = baseCost;
    gstAmount = round2((baseCost * gstRate) / 100);
    finalPrice = round2(baseCost + gstAmount);
  }

  const cgst = taxType === "CGST_SGST" ? round2(gstAmount / 2) : 0;
  const sgst = taxType === "CGST_SGST" ? round2(gstAmount - cgst) : 0;
  const igst = taxType === "IGST" ? gstAmount : 0;

  const profitPerUnit = round2(preTaxPrice - purchasePrice - fixedCostsTotal - customParamsTotal);
  const marginPct = finalPrice > 0 ? round2((profitPerUnit / finalPrice) * 100) : 0;

  const mrp = input.mrp && input.mrp > 0 ? round2(input.mrp) : undefined;
  const discountPct = mrp && mrp > finalPrice ? Math.round((1 - finalPrice / mrp) * 100) : undefined;

  return {
    purchasePrice,
    marginType: input.marginType,
    marginValue,
    marginAmount,
    fixedCosts,
    fixedCostsTotal,
    customParams,
    customParamsTotal,
    baseCost,
    suggestedGstRate,
    gstRate,
    gstInclusive,
    gstAmount,
    taxType,
    cgst,
    sgst,
    igst,
    preTaxPrice,
    finalPrice,
    mrp,
    discountPct,
    marginPct,
    profitPerUnit,
  };
}

export function solveMarginForTarget(
  targetFinalPrice: number,
  input: Omit<PricingInput, "marginValue">
): number | null {
  const purchasePrice = round2(Number(input.purchasePrice) || 0);
  const otherCosts = sumLines(input.fixedCosts) + sumLines(input.customParams);

  const solveForRate = (rate: number): number | null => {
    const base = input.gstInclusive ? targetFinalPrice : (targetFinalPrice * 100) / (100 + rate);
    const marginAmount = round2(base - purchasePrice - otherCosts);
    if (marginAmount < 0) return null;
    if (input.gstRate === undefined) {
      const consistent = suggestGstRate(round2(base)) === rate;
      if (!consistent) return null;
    }
    return marginAmount;
  };

  let marginAmount: number | null;
  if (input.gstRate !== undefined) {
    marginAmount = solveForRate(input.gstRate);
  } else {
    marginAmount = solveForRate(5) ?? solveForRate(12);
  }
  if (marginAmount === null) return null;

  if (input.marginType === "FLAT") return marginAmount;
  if (purchasePrice <= 0) return null;
  return round2((marginAmount / purchasePrice) * 100);
}
