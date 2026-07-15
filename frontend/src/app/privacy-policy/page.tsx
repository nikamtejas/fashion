import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — LuxeLoom",
  description: "What data LuxeLoom collects, how it's used, and your rights.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-sienna">Legal</p>
      <h1 className="font-display mt-2 text-4xl sm:text-5xl">Privacy policy</h1>
      <p className="mt-3 text-sm text-foreground/60">Last updated July 2026.</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/70">
        <section>
          <h2 className="text-base font-semibold text-foreground">What we collect</h2>
          <p className="mt-2">
            Account details (name, email, phone), delivery addresses, order and payment history,
            and browsing activity on the site such as items viewed and saved to your favorites.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">How we use it</h2>
          <p className="mt-2">
            To process and deliver your orders, send order and shipping updates, provide customer
            support, personalize product recommendations, and — if you&rsquo;ve subscribed — send
            occasional newsletters about new drops and offers. You can unsubscribe from marketing
            email at any time via the link in any newsletter.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Who we share it with</h2>
          <p className="mt-2">
            We share only what&rsquo;s needed to fulfil your order: payment details with Razorpay
            (and Snapmint for EMI orders), delivery address with our courier partner, and product
            images via our media host. We don&rsquo;t sell your personal data to third parties.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Cookies</h2>
          <p className="mt-2">
            We use essential cookies to keep you signed in and remember your cart. We don&rsquo;t
            use third-party advertising trackers.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Your rights</h2>
          <p className="mt-2">
            You can review and update your personal details from{" "}
            <Link href="/account/profile" className="text-accent underline underline-offset-2">your account</Link>,
            or request a copy or deletion of your data by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Contact</h2>
          <p className="mt-2">
            Questions about this policy? <Link href="/contact" className="text-accent underline underline-offset-2">Reach out to us</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
