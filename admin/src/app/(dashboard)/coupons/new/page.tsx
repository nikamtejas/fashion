"use client";

import { CouponForm } from "@/components/coupons/CouponForm";
import { createCoupon } from "@/lib/coupons";

export default function NewCouponPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">New coupon</h1>
      <div className="mt-6">
        <CouponForm
          onSubmit={async (input) => {
            await createCoupon(input);
          }}
        />
      </div>
    </div>
  );
}
