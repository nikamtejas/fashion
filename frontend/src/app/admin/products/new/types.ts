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
  fixedCosts: { name: string; value: number }[];
  gstRate: number;
  gstAmount: number;
  baseCost: number;
  finalPrice: number;
  mrp?: number;
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
