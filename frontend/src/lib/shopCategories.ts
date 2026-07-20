/** Single source of truth for category → subcategory dropdown values, shared
 * by the MegaMenu nav and the shop page's filter sidebar. Each `value` is
 * stored verbatim as a product tag in the backend seed data, so the API's
 * ?sub= filter is a direct tag match. */
export const SHOP_SUBCATEGORIES: Record<string, { label: string; value: string }[]> = {
  men: [
    { label: "Shirts", value: "shirts" },
    { label: "T-Shirts", value: "tshirts" },
    { label: "Trousers", value: "trousers" },
    { label: "Jeans", value: "jeans" },
    { label: "Jackets", value: "jackets" },
    { label: "Sweaters", value: "sweater" },
    { label: "Overshirts", value: "overshirt" },
    { label: "Ethnic Wear", value: "ethnic" },
    { label: "Activewear", value: "activewear" },
  ],
  women: [
    { label: "Dresses", value: "dresses" },
    { label: "Tops", value: "tops" },
    { label: "Jeans", value: "jeans" },
    { label: "Skirts", value: "skirt" },
    { label: "Ethnic Wear", value: "ethnic" },
    { label: "Outerwear", value: "outerwear" },
    { label: "Jumpsuits", value: "jumpsuits" },
    { label: "Sweaters", value: "sweater" },
    { label: "Activewear", value: "activewear" },
  ],
  accessories: [
    { label: "Bags", value: "bags" },
    { label: "Belts", value: "belts" },
    { label: "Jewelry", value: "jewelry" },
    { label: "Scarves", value: "scarves" },
    { label: "Sunglasses", value: "sunglasses" },
    { label: "Watches", value: "watches" },
    { label: "Wallets", value: "wallets" },
    { label: "Hats & Caps", value: "hats" },
  ],
  footwear: [
    { label: "Sneakers", value: "sneakers" },
    { label: "Formal", value: "formal" },
    { label: "Sandals", value: "sandals" },
    { label: "Boots", value: "boots" },
    { label: "Heels", value: "heels" },
    { label: "Flats", value: "flats" },
    { label: "Espadrilles", value: "espadrilles" },
  ],
};

export const SHOP_CATEGORY_LABELS: Record<string, string> = {
  men: "Men",
  women: "Women",
  accessories: "Accessories",
  footwear: "Footwear",
};
