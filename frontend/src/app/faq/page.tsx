"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS: { section: string; items: { q: string; a: React.ReactNode }[] }[] = [
  {
    section: "Orders & shipping",
    items: [
      {
        q: "How long does delivery take?",
        a: "Home delivery arrives in 3–5 days via Blue Dart courier, depending on your pincode. Free shipping applies on orders above ₹2,999.",
      },
      {
        q: "Can I pick up my order in-store instead?",
        a: (
          <>
            Yes — choose in-store pickup at checkout for any of our stores. Most orders are ready
            same day. See <Link href="/stores" className="text-accent underline underline-offset-2">store locations and hours</Link>.
          </>
        ),
      },
      {
        q: "How do I track my order?",
        a: (
          <>
            Open the order from <Link href="/account/orders" className="text-accent underline underline-offset-2">My Orders</Link> and
            tap Track — you&rsquo;ll see courier checkpoint scans or pickup status in real time.
          </>
        ),
      },
    ],
  },
  {
    section: "Payments",
    items: [
      {
        q: "What payment methods do you accept?",
        a: "Cards, UPI, netbanking and wallets via Razorpay, Cash on Delivery (a small convenience fee applies), and EMI through Snapmint on eligible orders.",
      },
      {
        q: "Is Cash on Delivery available on every order?",
        a: "COD is available up to a maximum order value shown at checkout — above that, please pay online or via EMI.",
      },
    ],
  },
  {
    section: "Returns & sizing",
    items: [
      {
        q: "What's your return policy?",
        a: (
          <>
            Returns are accepted within 14 days of delivery on unworn items with tags attached. See{" "}
            <Link href="/returns" className="text-accent underline underline-offset-2">Returns & Refunds</Link> for the full policy and to start a return.
          </>
        ),
      },
      {
        q: "How do I know what size to order?",
        a: "Each product page lists the available sizes and stock for that item. If you're between two sizes, we generally recommend sizing up.",
      },
    ],
  },
];

function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border-b border-border py-4">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 text-left">
        <span className="text-sm font-medium">{q}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-foreground/50 transition-transform", open && "rotate-180")} />
      </button>
      {open && <p className="mt-3 text-sm leading-relaxed text-foreground/60">{a}</p>}
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-sienna">Help</p>
      <h1 className="font-display mt-2 text-4xl sm:text-5xl">Frequently asked questions</h1>

      <div className="mt-10 space-y-10">
        {FAQS.map((section) => (
          <div key={section.section}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">{section.section}</h2>
            <div className="mt-2">
              {section.items.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-12 text-sm text-foreground/60">
        Still stuck?{" "}
        <Link href="/contact" className="text-accent underline underline-offset-2">
          Contact us
        </Link>{" "}
        and we&rsquo;ll help you out directly.
      </p>
    </div>
  );
}
