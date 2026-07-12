export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  brand: string;
  tags: string[];
  category: { name: string; slug: string } | string;
  variants: { size: string; color: string; colorHex?: string; sku: string; stock: number }[];
  images: { publicId: string; url: string; type: string; altText?: string; order: number }[];
  pricing: { finalPrice: number; mrp?: number };
  ratingAvg: number;
  ratingCount: number;
}
