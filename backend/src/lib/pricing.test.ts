import { describe, it, expect } from "vitest";
import { computePricing, solveMarginForTarget, suggestGstRate } from "./pricing";

describe("suggested GST slab (Indian apparel rule)", () => {
  it("suggests 5% at a Base Price of exactly ₹1,000", () => {
    expect(suggestGstRate(1000)).toBe(5);
    const b = computePricing({ purchasePrice: 1000, marginType: "FLAT", marginValue: 0 });
    expect(b.baseCost).toBe(1000);
    expect(b.suggestedGstRate).toBe(5);
    expect(b.gstRate).toBe(5);
  });

  it("suggests 12% just above ₹1,000", () => {
    expect(suggestGstRate(1000.01)).toBe(12);
    const b = computePricing({ purchasePrice: 1001, marginType: "FLAT", marginValue: 0 });
    expect(b.suggestedGstRate).toBe(12);
  });

  it("crosses the boundary when margin pushes the Base Price over it", () => {
    const below = computePricing({ purchasePrice: 900, marginType: "FLAT", marginValue: 100 });
    expect(below.baseCost).toBe(1000);
    expect(below.suggestedGstRate).toBe(5);

    const above = computePricing({ purchasePrice: 900, marginType: "FLAT", marginValue: 100.01 });
    expect(above.baseCost).toBe(1000.01);
    expect(above.suggestedGstRate).toBe(12);
  });

  it("honors an explicit slab override (18% accessories)", () => {
    const b = computePricing({ purchasePrice: 500, marginType: "FLAT", marginValue: 0, gstRate: 18 });
    expect(b.suggestedGstRate).toBe(5);
    expect(b.gstRate).toBe(18);
    expect(b.gstAmount).toBe(90);
    expect(b.finalPrice).toBe(590);
  });
});

describe("flat vs percentage margin", () => {
  it("computes identical breakdowns when flat equals the percentage amount", () => {
    const pct = computePricing({ purchasePrice: 800, marginType: "PERCENTAGE", marginValue: 30 });
    const flat = computePricing({ purchasePrice: 800, marginType: "FLAT", marginValue: 240 });
    expect(pct.marginAmount).toBe(240);
    expect(flat.marginAmount).toBe(240);
    expect(pct.baseCost).toBe(flat.baseCost);
    expect(pct.finalPrice).toBe(flat.finalPrice);
    expect(pct.profitPerUnit).toBe(flat.profitPerUnit);
  });

  it("percentage margin is computed on the purchase price only, not on costs", () => {
    const b = computePricing({
      purchasePrice: 1000,
      marginType: "PERCENTAGE",
      marginValue: 10,
      fixedCosts: [{ name: "Packaging", value: 500 }],
    });
    expect(b.marginAmount).toBe(100); // 10% of 1000, not of 1500
  });
});

describe("Base Price composition", () => {
  it("sums purchase + margin + fixed costs + custom parameters", () => {
    const b = computePricing({
      purchasePrice: 500,
      marginType: "FLAT",
      marginValue: 100,
      fixedCosts: [
        { name: "Packaging", value: 30 },
        { name: "Logistics", value: 20 },
      ],
      customParams: [
        { name: "Platform fee", value: 40 },
        { name: "Handling", value: 10 },
      ],
    });
    expect(b.fixedCostsTotal).toBe(50);
    expect(b.customParamsTotal).toBe(50);
    expect(b.baseCost).toBe(700);
    expect(b.suggestedGstRate).toBe(5);
    expect(b.finalPrice).toBe(735);
  });
});

describe("GST-inclusive vs GST-exclusive", () => {
  it("exclusive: final = base + GST", () => {
    const b = computePricing({
      purchasePrice: 800,
      marginType: "FLAT",
      marginValue: 240,
      fixedCosts: [{ name: "Fixed", value: 120 }],
      gstInclusive: false,
    });
    expect(b.baseCost).toBe(1160);
    expect(b.gstRate).toBe(12);
    expect(b.gstAmount).toBe(139.2);
    expect(b.preTaxPrice).toBe(1160);
    expect(b.finalPrice).toBe(1299.2);
  });

  it("inclusive: final = base, GST extracted from within it", () => {
    const b = computePricing({
      purchasePrice: 800,
      marginType: "FLAT",
      marginValue: 240,
      fixedCosts: [{ name: "Fixed", value: 120 }],
      gstInclusive: true,
    });
    expect(b.finalPrice).toBe(1160);
    expect(b.gstAmount).toBe(124.29); // 1160 × 12 ÷ 112
    expect(b.preTaxPrice).toBe(1035.71);
    expect(b.preTaxPrice + b.gstAmount).toBeCloseTo(b.finalPrice, 2);
  });

  it("inclusive pricing eats the GST out of profit", () => {
    const excl = computePricing({ purchasePrice: 500, marginType: "FLAT", marginValue: 200, gstInclusive: false });
    const incl = computePricing({ purchasePrice: 500, marginType: "FLAT", marginValue: 200, gstInclusive: true });
    expect(excl.profitPerUnit).toBe(200);
    expect(incl.profitPerUnit).toBe(round2(200 - incl.gstAmount));
  });
});

const round2 = (n: number) => Math.round(n * 100) / 100;

describe("CGST/SGST vs IGST", () => {
  it("splits GST evenly for intra-state (CGST_SGST)", () => {
    const b = computePricing({
      purchasePrice: 800,
      marginType: "PERCENTAGE",
      marginValue: 30,
      fixedCosts: [{ name: "Fixed", value: 120 }],
      taxType: "CGST_SGST",
    });
    expect(b.cgst).toBe(69.6);
    expect(b.sgst).toBe(69.6);
    expect(b.igst).toBe(0);
    expect(round2(b.cgst + b.sgst)).toBe(b.gstAmount);
  });

  it("puts the whole GST in IGST for inter-state", () => {
    const b = computePricing({ purchasePrice: 1000, marginType: "FLAT", marginValue: 0, taxType: "IGST" });
    expect(b.igst).toBe(b.gstAmount);
    expect(b.cgst).toBe(0);
    expect(b.sgst).toBe(0);
  });

  it("halves with odd paise still sum exactly to the GST amount", () => {
    // gstAmount = 0.05 → naive halves are 0.025/0.025 which round to 0.03/0.03 = 0.06 ≠ 0.05
    const b = computePricing({ purchasePrice: 1, marginType: "FLAT", marginValue: 0, taxType: "CGST_SGST" });
    expect(round2(b.cgst + b.sgst)).toBe(b.gstAmount);
  });
});

describe("MRP compare-at and discount badge", () => {
  it("computes the whole-percent discount when MRP exceeds the final price", () => {
    const b = computePricing({ purchasePrice: 500, marginType: "FLAT", marginValue: 100, mrp: 1499 });
    expect(b.finalPrice).toBe(630);
    expect(b.discountPct).toBe(58);
  });

  it("omits the discount when MRP is missing or not higher", () => {
    const none = computePricing({ purchasePrice: 500, marginType: "FLAT", marginValue: 100 });
    expect(none.discountPct).toBeUndefined();
    const lower = computePricing({ purchasePrice: 500, marginType: "FLAT", marginValue: 100, mrp: 600 });
    expect(lower.discountPct).toBeUndefined();
  });
});

describe("psychological pricing back-solve", () => {
  it("solves a flat margin that lands exactly on ₹999 (5% slab, exclusive)", () => {
    const base = { purchasePrice: 500, marginType: "FLAT" as const, fixedCosts: [{ name: "Fixed", value: 100 }] };
    const margin = solveMarginForTarget(999, base);
    expect(margin).not.toBeNull();
    const b = computePricing({ ...base, marginValue: margin! });
    expect(b.finalPrice).toBe(999);
    expect(b.gstRate).toBe(5);
  });

  it("solves across the slab: ₹1,499 target self-consistently picks 12%", () => {
    const base = { purchasePrice: 500, marginType: "FLAT" as const, fixedCosts: [{ name: "Fixed", value: 100 }] };
    const margin = solveMarginForTarget(1499, base);
    expect(margin).not.toBeNull();
    const b = computePricing({ ...base, marginValue: margin! });
    expect(b.finalPrice).toBe(1499);
    expect(b.gstRate).toBe(12);
  });

  it("returns a percentage when marginType is PERCENTAGE", () => {
    const base = { purchasePrice: 500, marginType: "PERCENTAGE" as const };
    const pct = solveMarginForTarget(630, base); // base 600 → 5% → 630
    expect(pct).toBe(20);
    const b = computePricing({ ...base, marginValue: pct! });
    expect(b.finalPrice).toBe(630);
  });

  it("returns null when the target is below cost", () => {
    expect(solveMarginForTarget(400, { purchasePrice: 500, marginType: "FLAT" })).toBeNull();
  });

  it("respects an explicit slab override when solving", () => {
    const base = { purchasePrice: 500, marginType: "FLAT" as const, gstRate: 18 };
    const margin = solveMarginForTarget(1180, base);
    expect(margin).toBe(500); // base 1000 → +18% = 1180
    const b = computePricing({ ...base, marginValue: margin! });
    expect(b.finalPrice).toBe(1180);
  });
});

describe("spec verification case: ₹800 purchase, 30% margin, ₹120 fixed cost", () => {
  const input = {
    purchasePrice: 800,
    marginType: "PERCENTAGE" as const,
    marginValue: 30,
    fixedCosts: [{ name: "Packaging & Logistics", value: 120 }],
  };

  it("suggests the 12% slab (Base Price ₹1,160 > ₹1,000)", () => {
    const b = computePricing(input);
    expect(b.marginAmount).toBe(240);
    expect(b.baseCost).toBe(1160);
    expect(b.suggestedGstRate).toBe(12);
    expect(b.gstRate).toBe(12);
  });

  it("itemizes the full breakdown correctly", () => {
    const b = computePricing(input);
    expect(b.gstAmount).toBe(139.2);
    expect(b.finalPrice).toBe(1299.2);
    expect(b.profitPerUnit).toBe(240);
    expect(b.marginPct).toBe(18.47);
    expect(b.cgst).toBe(69.6);
    expect(b.sgst).toBe(69.6);
  });
});
