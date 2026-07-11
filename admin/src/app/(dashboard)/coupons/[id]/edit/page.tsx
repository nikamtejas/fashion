"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CouponForm } from "@/components/coupons/CouponForm";
import { getCoupon, updateCoupon, type Coupon } from "@/lib/coupons";
import { ApiRequestError } from "@/lib/api";

export default function EditCouponPage() {
  const { id } = useParams<{ id: string }>();
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCoupon(id)
      .then((res) => setCoupon(res.coupon))
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : "Failed to load coupon"));
  }, [id]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!coupon) {
    return (
      <div className="flex max-w-md flex-col gap-4">
        <div className="h-8 w-48 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="h-64 w-full animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Edit coupon</h1>
      <div className="mt-6">
        <CouponForm
          initial={coupon}
          onSubmit={async (input) => {
            await updateCoupon(id, input);
          }}
        />
      </div>
    </div>
  );
}
