/** Single source of truth for category → subcategory dropdown values, shared
 * by the MegaMenu nav and the shop page's filter sidebar. Each `value` is
 * stored verbatim as a product tag in the backend seed data, so the API's
 * ?sub= filter is a direct tag match. */
export const SHOP_SUBCATEGORIES: Record<string, { label: string; value: string }[]> = {
  men: [
    { label: "Shirts", value: "shirts" },
    { label: "T-Shirts", value: "tshirts" },
    { label: "Trousers", value: "trousers" },
    { label: "Jackets", value: "jackets" },
  ],
  women: [
    { label: "Dresses", value: "dresses" },
    { label: "Tops", value: "tops" },
    { label: "Ethnic Wear", value: "ethnic" },
    { label: "Outerwear", value: "outerwear" },
  ],
  accessories: [
    { label: "Bags", value: "bags" },
    { label: "Belts", value: "belts" },
    { label: "Jewelry", value: "jewelry" },
    { label: "Scarves", value: "scarves" },
  ],
  footwear: [
    { label: "Sneakers", value: "sneakers" },
    { label: "Formal", value: "formal" },
    { label: "Sandals", value: "sandals" },
    { label: "Boots", value: "boots" },
  ],
};

export const SHOP_CATEGORY_LABELS: Record<string, string> = {
  men: "Men",
  women: "Women",
  accessories: "Accessories",
  footwear: "Footwear",
};
