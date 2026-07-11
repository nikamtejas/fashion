"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { addAddress, type Address } from "@/lib/auth";
import { createRazorpayCheckout, verifyRazorpayCheckout, placeCodOrder, type ShippingAddress } from "@/lib/orders";
import { loadRazorpayScript, openRazorpayCheckout } from "@/lib/razorpay";
import { ApiRequestError } from "@/lib/api";

function toShippingAddress(address: Address): ShippingAddress {
  return {
    line1: address.line1,
    line2: address.line2 ?? undefined,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
  };
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, refresh: refreshAuth } = useAuth();
  const { cart, isLoading: cartLoading, refresh: refreshCart } = useCart();

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({ line1: "", line2: "", city: "", state: "", pincode: "" });
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const [whatsapp, setWhatsapp] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "cod">("razorpay");
  const [error, setError] = useState<string | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?next=/checkout");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!cartLoading && user && cart.items.length === 0) {
      router.replace("/cart");
    }
  }, [cartLoading, user, cart.items.length, router]);

  // Derive checkout defaults from `user` the moment it finishes loading — done during
  // render (React's documented pattern for "adjust state when a prop changes") rather
  // than in an Effect, since it only needs to run once per distinct user, not on every
  // commit. `initializedUserId` guards it so it doesn't re-run every render.
  const [initializedUserId, setInitializedUserId] = useState<string | null>(null);
  if (user && user.id !== initializedUserId) {
    setInitializedUserId(user.id);
    setSelectedAddressId(user.addresses.find((a) => a.isDefault)?.id ?? user.addresses[0]?.id ?? null);
    setShowNewAddressForm(user.addresses.length === 0);
    setWhatsapp(user.whatsappNumber ?? user.phone ?? "");
  }

  if (authLoading || !user || cartLoading || cart.items.length === 0) {
    return (
      <div className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 h-6 w-32 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="h-64 w-full animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
      </div>
    );
  }

  async function handleSaveAddress(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSavingAddress(true);
    try {
      const { user: updatedUser } = await addAddress(newAddress);
      await refreshAuth();
      const newlyAdded = updatedUser.addresses[updatedUser.addresses.length - 1];
      if (newlyAdded) setSelectedAddressId(newlyAdded.id);
      setShowNewAddressForm(false);
      setNewAddress({ line1: "", line2: "", city: "", state: "", pincode: "" });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to save address");
    } finally {
      setIsSavingAddress(false);
    }
  }

  async function handlePlaceOrder() {
    setError(null);
    const address = user!.addresses.find((a) => a.id === selectedAddressId);
    if (!address) {
      setError("Please add a shipping address.");
      return;
    }
    if (!whatsapp.trim()) {
      setError("Please enter a WhatsApp number.");
      return;
    }

    setIsPlacing(true);
    try {
      if (paymentMethod === "cod") {
        const { order } = await placeCodOrder({
          shippingAddress: toShippingAddress(address),
          whatsappNumber: whatsapp.trim(),
        });
        await refreshCart();
        router.push(`/orders/${order._id}`);
        return;
      }

      const checkout = await createRazorpayCheckout();
      await loadRazorpayScript();
      openRazorpayCheckout({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        order_id: checkout.razorpayOrderId,
        name: "FASHION.CO",
        prefill: { name: user!.name, email: user!.email, contact: whatsapp.trim() },
        handler: (response) => {
          verifyRazorpayCheckout({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            shippingAddress: toShippingAddress(address),
            whatsappNumber: whatsapp.trim(),
          })
            .then(async ({ order }) => {
              await refreshCart();
              router.push(`/orders/${order._id}`);
            })
            .catch((err) => {
              setError(err instanceof ApiRequestError ? err.message : "Payment verification failed");
              setIsPlacing(false);
            });
        },
        modal: { ondismiss: () => setIsPlacing(false) },
      });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to start checkout");
      setIsPlacing(false);
    }
  }

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 text-xl font-semibold tracking-tight sm:text-2xl">Checkout</h1>

      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold">Shipping address</h2>
            {user.addresses.length > 0 && (
              <div className="flex flex-col gap-2">
                {user.addresses.map((address) => (
                  <label
                    key={address.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                      selectedAddressId === address.id
                        ? "border-black dark:border-white"
                        : "border-black/15 dark:border-white/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={selectedAddressId === address.id}
                      onChange={() => setSelectedAddressId(address.id)}
                      className="mt-1"
                    />
                    <span>
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state} —{" "}
                      {address.pincode}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {!showNewAddressForm ? (
              <button
                type="button"
                onClick={() => setShowNewAddressForm(true)}
                className="mt-3 text-sm font-medium underline underline-offset-2"
              >
                + Add a new address
              </button>
            ) : (
              <form onSubmit={handleSaveAddress} className="mt-3 flex flex-col gap-2 rounded-lg border border-black/10 p-3 dark:border-white/10">
                <input
                  value={newAddress.line1}
                  onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
                  placeholder="Address line 1"
                  required
                  className="h-10 rounded-md border border-black/15 bg-transparent px-2 text-sm dark:border-white/20"
                />
                <input
                  value={newAddress.line2}
                  onChange={(e) => setNewAddress({ ...newAddress, line2: e.target.value })}
                  placeholder="Address line 2 (optional)"
                  className="h-10 rounded-md border border-black/15 bg-transparent px-2 text-sm dark:border-white/20"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={newAddress.city}
                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                    placeholder="City"
                    required
                    className="h-10 rounded-md border border-black/15 bg-transparent px-2 text-sm dark:border-white/20"
                  />
                  <input
                    value={newAddress.state}
                    onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                    placeholder="State"
                    required
                    className="h-10 rounded-md border border-black/15 bg-transparent px-2 text-sm dark:border-white/20"
                  />
                </div>
                <input
                  value={newAddress.pincode}
                  onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                  placeholder="Pincode"
                  required
                  className="h-10 w-full rounded-md border border-black/15 bg-transparent px-2 text-sm dark:border-white/20 sm:w-40"
                />
                <div className="mt-1 flex gap-2">
                  <button
                    type="submit"
                    disabled={isSavingAddress}
                    className="h-9 rounded-full bg-black px-4 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
                  >
                    {isSavingAddress ? "Saving…" : "Save address"}
                  </button>
                  {user.addresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowNewAddressForm(false)}
                      className="h-9 rounded-full px-4 text-sm font-medium text-black/60 dark:text-white/60"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </section>

          <section>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              WhatsApp number
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                required
                className="h-11 max-w-xs rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
              />
            </label>
            <p className="mt-1 text-xs text-black/50 dark:text-white/50">
              We&apos;ll send your order confirmation and tracking link here.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold">Payment method</h2>
            <div className="flex flex-col gap-2">
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${
                  paymentMethod === "razorpay" ? "border-black dark:border-white" : "border-black/15 dark:border-white/20"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === "razorpay"}
                  onChange={() => setPaymentMethod("razorpay")}
                />
                Card / UPI / Netbanking / EMI (Razorpay)
              </label>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${
                  paymentMethod === "cod" ? "border-black dark:border-white" : "border-black/15 dark:border-white/20"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === "cod"}
                  onChange={() => setPaymentMethod("cod")}
                />
                Cash on delivery
              </label>
            </div>
          </section>
        </div>

        <div className="h-fit rounded-xl border border-black/10 p-5 dark:border-white/10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Order summary
          </p>
          <div className="flex flex-col gap-1 text-sm">
            {cart.items.map((item) => (
              <div key={item.itemId} className="flex justify-between text-black/70 dark:text-white/70">
                <span className="truncate pr-2">
                  {item.productName} × {item.qty}
                </span>
                <span>₹{item.lineTotal.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="my-3 border-t border-black/10 dark:border-white/10" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-black/60 dark:text-white/60">Subtotal</span>
            <span>₹{cart.subtotal.toFixed(2)}</span>
          </div>
          {cart.coupon && (
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-black/60 dark:text-white/60">Coupon ({cart.coupon.code})</span>
              <span>−₹{cart.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="my-3 border-t border-black/10 dark:border-white/10" />
          <div className="flex items-center justify-between text-base font-medium">
            <span>Total</span>
            <span>₹{cart.total.toFixed(2)}</span>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={isPlacing}
            className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-black text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {isPlacing ? "Placing order…" : "Place order"}
          </button>
        </div>
      </div>
    </div>
  );
}
