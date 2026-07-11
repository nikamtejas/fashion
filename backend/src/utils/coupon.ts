// Per SPEC.md §4.3: flat or percentage off, optional max discount cap, never more
// than the subtotal itself.
export interface CouponRules {
  type: "flat" | "percentage";
  value: number;
  maxDiscount?: number | null;
}

export function computeCouponDiscount(coupon: CouponRules, subtotal: number): number {
  let discount = coupon.type === "flat" ? coupon.value : subtotal * (coupon.value / 100);
  if (coupon.maxDiscount != null) {
    discount = Math.min(discount, coupon.maxDiscount);
  }
  return Math.min(discount, subtotal);
}

export interface CouponEligibility extends CouponRules {
  minCartValue?: number | null;
  expiresAt?: Date | null;
  usageLimit?: number | null;
  usedCount: number;
  applicableCategories: string[];
  active: boolean;
}

export interface CartLineForCoupon {
  category: string;
}

export type CouponValidationResult =
  | { valid: true; discount: number }
  | { valid: false; reason: string };

// Shared by the "apply coupon" endpoint and the cart's read-time recompute, so a
// coupon that was valid when applied but has since expired / hit its usage limit /
// no longer meets minCartValue (items removed) is dropped consistently everywhere.
export function validateCouponForCart(
  coupon: CouponEligibility,
  lines: CartLineForCoupon[],
  subtotal: number
): CouponValidationResult {
  if (!coupon.active) {
    return { valid: false, reason: "This coupon is no longer active" };
  }
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return { valid: false, reason: "This coupon has expired" };
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, reason: "This coupon has reached its usage limit" };
  }
  if (coupon.minCartValue != null && subtotal < coupon.minCartValue) {
    return { valid: false, reason: `Minimum cart value of ₹${coupon.minCartValue} not met` };
  }
  if (coupon.applicableCategories.length > 0) {
    const hasMatch = lines.some((line) => coupon.applicableCategories.includes(line.category));
    if (!hasMatch) {
      return { valid: false, reason: "This coupon doesn't apply to items in your cart" };
    }
  }
  return { valid: true, discount: computeCouponDiscount(coupon, subtotal) };
}
