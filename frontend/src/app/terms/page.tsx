import Link from "next/link";

export const metadata = {
  title: "Terms of Service — LuxeLoom",
  description: "The terms that govern using LuxeLoom and placing an order.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-sienna">Legal</p>
      <h1 className="font-display mt-2 text-4xl sm:text-5xl">Terms of service</h1>
      <p className="mt-3 text-sm text-foreground/60">Last updated July 2026.</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/70">
        <section>
          <h2 className="text-base font-semibold text-foreground">Using LuxeLoom</h2>
          <p className="mt-2">
            By creating an account or placing an order, you agree to these terms. You&rsquo;re
            responsible for keeping your account credentials secure and for the accuracy of the
            information you provide.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Orders & pricing</h2>
          <p className="mt-2">
            Prices are shown in Indian Rupees and include applicable GST unless stated otherwise.
            We reserve the right to correct pricing or listing errors, and to cancel and refund an
            order affected by one. Placing an order is an offer to buy — a contract forms once we
            confirm and dispatch it.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Payments</h2>
          <p className="mt-2">
            Online payments are processed by Razorpay; EMI orders by Snapmint. We never store your
            full card details on our servers.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Returns & cancellations</h2>
          <p className="mt-2">
            Governed by our{" "}
            <Link href="/returns" className="text-accent underline underline-offset-2">Returns & Refunds policy</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Intellectual property</h2>
          <p className="mt-2">
            All product photography, text and branding on this site belong to LuxeLoom and may not
            be reproduced without permission.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Limitation of liability</h2>
          <p className="mt-2">
            LuxeLoom is not liable for indirect or consequential loss arising from use of the
            site, to the extent permitted by law. Nothing here limits any right you have under
            Indian consumer protection law.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Governing law</h2>
          <p className="mt-2">These terms are governed by the laws of India.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Contact</h2>
          <p className="mt-2">
            Questions about these terms? <Link href="/contact" className="text-accent underline underline-offset-2">Reach out to us</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
