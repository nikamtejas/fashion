"use client";

import Link from "next/link";
import { Mail, Phone, MapPin, Clock, MessageCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";

const CHANNELS = [
  { icon: Mail, label: "Email", value: "hello@luxeloom.in", href: "mailto:hello@luxeloom.in" },
  { icon: Phone, label: "Phone", value: "+91 22 4001 2345", href: "tel:+912240012345" },
  { icon: MapPin, label: "Studio", value: "Lower Parel, Mumbai, Maharashtra 400013" },
  { icon: Clock, label: "Hours", value: "Mon–Sat, 10am–7pm IST" },
];

export default function ContactPage() {
  const { user, loading } = useAuth();
  const supportHref = !loading && user
    ? "/account/profile?tab=support"
    : `/login?callbackUrl=${encodeURIComponent("/account/profile?tab=support")}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-sienna">Help</p>
      <h1 className="font-display mt-2 text-4xl sm:text-5xl">Contact us</h1>
      <p className="mt-3 max-w-lg text-sm text-foreground/60">
        Questions about an order, a product, or anything else — we usually reply within a day.
      </p>

      <div className="mt-12 grid gap-8 sm:grid-cols-2">
        <div className="space-y-6">
          {CHANNELS.map((c) => (
            <div key={c.label} className="flex items-start gap-3">
              <span className="mt-0.5 rounded-full bg-foreground/5 p-2">
                <c.icon className="h-4 w-4 text-foreground/60" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wider text-foreground/50">{c.label}</p>
                {c.href ? (
                  <a href={c.href} className="text-sm font-medium hover:text-accent">
                    {c.value}
                  </a>
                ) : (
                  <p className="text-sm font-medium">{c.value}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-surface p-6">
          <MessageCircle className="h-6 w-6 text-sienna" />
          <div>
            <p className="text-sm font-semibold">Message our support team</p>
            <p className="mt-1 text-sm text-foreground/60">
              Sign in to start a conversation — we can look up your orders and reply right here on
              the site.
            </p>
          </div>
          <Button asChild size="sm" magnetic={false}>
            <Link href={supportHref}>Start a conversation</Link>
          </Button>
          <p className="text-xs text-foreground/50">
            Returning an item?{" "}
            <Link href="/returns" className="underline underline-offset-2 hover:text-foreground">
              See our returns policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
