import Link from "next/link";

export const metadata = {
  title: "Shipping Policy — LuxeLoom",
  description: "How LuxeLoom ships orders — delivery times, cost, and in-store pickup.",
};

export default function ShippingPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-sienna">Help</p>
      <h1 className="font-display mt-2 text-4xl sm:text-5xl">Shipping policy</h1>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/70">
        <section>
          <h2 className="text-base font-semibold text-foreground">Home delivery</h2>
          <p className="mt-2">
            We ship pan-India via Blue Dart courier. Orders typically arrive within 3–5 business
            days of dispatch, depending on your pincode. Shipping is free on orders above ₹2,999;
            a flat delivery fee applies below that threshold, shown at checkout.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">In-store pickup</h2>
          <p className="mt-2">
            Choose in-store pickup at checkout to collect your order at any LuxeLoom store, often
            same day. See <Link href="/stores" className="text-accent underline underline-offset-2">store locations and hours</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Order processing</h2>
          <p className="mt-2">
            Orders are packed and handed to courier within 1–2 business days of payment
            confirmation. You&rsquo;ll get an email once your order ships, with a tracking link.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Tracking</h2>
          <p className="mt-2">
            Track any order from{" "}
            <Link href="/account/orders" className="text-accent underline underline-offset-2">My Orders</Link> — you&rsquo;ll
            see live courier checkpoint scans for home delivery, or pickup readiness for in-store
            orders.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Delays</h2>
          <p className="mt-2">
            Weather, regional holidays and courier network disruptions can occasionally push
            delivery past the usual window. If your order is significantly delayed,{" "}
            <Link href="/contact" className="text-accent underline underline-offset-2">contact us</Link> and we&rsquo;ll look into it.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">International shipping</h2>
          <p className="mt-2">We currently ship within India only.</p>
        </section>
      </div>
    </div>
  );
}
