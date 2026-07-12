"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCartStore } from "@/store/cartStore";
import { apiFetch } from "@/lib/api";
import { Stepper } from "@/components/ui/Stepper";
import { CartSummary } from "@/components/cart/CartSummary";
import { AddressStep } from "@/components/checkout/AddressStep";
import { DeliveryStep } from "@/components/checkout/DeliveryStep";
import { PaymentStep } from "@/components/checkout/PaymentStep";
import type { CheckoutSelection } from "@/components/checkout/types";

const STEPS = [{ label: "Address" }, { label: "Delivery" }, { label: "Payment" }];

export function CheckoutClient() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const cart = useCartStore((s) => s.cart);
  const loaded = useCartStore((s) => s.loaded);

  const [step, setStep] = React.useState(0);
  const [selection, setSelection] = React.useState<CheckoutSelection>({ deliveryMethod: null });
  const [pincode, setPincode] = React.useState("");
  const [serviceable, setServiceable] = React.useState(true);
  const [etaDays, setEtaDays] = React.useState<number | undefined>();

  React.useEffect(() => {
    if (!authLoading && !user) router.replace("/login?callbackUrl=/checkout");
  }, [authLoading, user, router]);

  // Redirect only once the cart has genuinely loaded as empty — never on a
  // transient pre-load frame (that exact flicker bit the previous build).
  // The payment step is exempt: order placement legitimately empties the
  // cart while its flows (verify, confirmation redirect) are mid-flight.
  React.useEffect(() => {
    if (user && loaded && cart && cart.items.length === 0 && step < 2) {
      router.replace("/cart");
    }
  }, [user, loaded, cart, step, router]);

  if (authLoading || !user || !loaded || !cart) {
    return <div className="py-20 text-center text-sm text-foreground/50">Loading checkout…</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl">Checkout</h1>
      <Stepper steps={STEPS} currentStep={step} className="my-8 max-w-md" />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
        <div>
          {step === 0 && (
            <AddressStep
              onContinue={({ addressId, address, pincode: pin }) => {
                setSelection((s) => ({ ...s, addressId, address }));
                setPincode(pin);
                apiFetch<{ serviceable: boolean; etaDays?: number }>(`/api/stores/serviceability/${pin}`)
                  .then((r) => {
                    setServiceable(r.serviceable);
                    setEtaDays(r.etaDays);
                  })
                  .catch(() => setServiceable(true));
                setStep(1);
              }}
            />
          )}

          {step === 1 && (
            <DeliveryStep
              defaultPincode={pincode}
              homeServiceable={serviceable}
              homeEtaDays={etaDays}
              onBack={() => setStep(0)}
              onContinue={(sel) => {
                setSelection((s) => ({ ...s, ...sel }));
                setStep(2);
              }}
            />
          )}

          {step === 2 && (
            <div className="space-y-5">
              {selection.deliveryMethod === "PICKUP" && (
                <p className="text-xs text-foreground/60">
                  Picking up at <span className="font-medium">{selection.storeName}</span> on{" "}
                  <span className="font-medium">
                    {selection.appointment?.date}, {selection.appointment?.timeSlot}
                  </span>
                </p>
              )}

              <PaymentStep
                total={cart.totals.total}
                onBack={() => setStep(1)}
                payload={
                  selection.deliveryMethod === "PICKUP"
                    ? { deliveryMethod: "PICKUP", storeId: selection.storeId, appointment: selection.appointment }
                    : { deliveryMethod: "HOME", addressId: selection.addressId }
                }
              />
            </div>
          )}
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-24">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Order summary</p>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
            {cart.items.map((i) => (
              <li key={i.sku} className="flex justify-between gap-2 text-foreground/70">
                <span className="truncate">
                  {i.name} · {i.size} × {i.qty}
                </span>
                <span className="shrink-0 tabular-nums">₹{i.lineTotal.toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
          <div className="my-4 h-px bg-border" />
          <CartSummary totals={cart.totals} coupon={cart.coupon} />
        </aside>
      </div>
    </div>
  );
}
