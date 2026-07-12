export interface WizardImage {
  _id: string;
  publicId: string;
  secureUrl: string;
  type: "ORIGINAL" | "STUDIO" | "AI_MODEL";
  side?: "FRONT" | "BACK";
  slot?: "MODEL_FRONT" | "LIFESTYLE";
  color?: string;
  altText?: string;
  order: number;
  isCover?: boolean;
  faithfulnessFlag?: boolean;
}

export interface WizardVariant {
  size: string;
  color: string;
  colorHex?: string;
  sku: string;
  stock: number;
}

export interface WizardPricing {
  purchasePrice: number;
  marginType: "PERCENTAGE" | "FLAT";
  marginValue: number;
  marginAmount: number;
  fixedCosts: { name: string; value: number }[];
  fixedCostsTotal: number;
  customParams: { name: string; value: number }[];
  customParamsTotal: number;
  baseCost: number;
  suggestedGstRate: number;
  gstRate: number;
  gstInclusive: boolean;
  gstAmount: number;
  taxType: "CGST_SGST" | "IGST";
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

export interface WizardProduct {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: string | { _id: string; name: string; slug: string };
  gender: "MEN" | "WOMEN" | "UNISEX";
  brand: string;
  tags: string[];
  variants: WizardVariant[];
  images: WizardImage[];
  pricing: WizardPricing;
  status: "DRAFT" | "PUBLISHED";
}
