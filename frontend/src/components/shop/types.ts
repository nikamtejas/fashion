export interface ShopProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  mrp?: number;
  image: string | null;
  hoverImage: string | null;
  sizes: string[];
  colors: { name: string; hex?: string }[];
  inStock: boolean;
}
