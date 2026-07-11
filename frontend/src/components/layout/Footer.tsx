"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api";

const FOOTER_LINKS: Record<string, { label: string; href: string }[]> = {
  Shop: [
    { label: "Men", href: "/shop?category=men" },
    { label: "Women", href: "/shop?category=women" },
    { label: "Accessories", href: "/shop?category=accessories" },
    { label: "Footwear", href: "/shop?category=footwear" },
  ],
  Company: [
    { label: "Our Story", href: "/about" },
    { label: "Store Locator", href: "/stores" },
    { label: "Track Order", href: "/track" },
  ],
  Help: [
    { label: "Contact Us", href: "/contact" },
    { label: "Returns & Refunds", href: "/returns" },
    { label: "Size Guide", href: "/size-guide" },
  ],
};

export function Footer() {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await apiFetch("/api/newsletter/subscribe", { method: "POST", json: { email } });
      toast({ title: "You're on the list", description: "Welcome to LuxeLoom.", variant: "success" });
      setEmail("");
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <p className="font-display text-2xl">LUXELOOM</p>
            <p className="mt-3 max-w-xs text-sm text-foreground/60">
              Editorial fashion for the modern Indian wardrobe — considered pieces, honest pricing.
            </p>
            <form onSubmit={handleSubscribe} className="mt-6 flex max-w-sm gap-2">
              <Input
                type="email"
                required
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
              <Button type="submit" size="sm" disabled={loading} magnetic={false}>
                {loading ? "…" : "Subscribe"}
              </Button>
            </form>
            <div className="mt-6 flex gap-4 text-xs uppercase tracking-wider text-foreground/50">
              <a href="#" className="hover:text-accent">Instagram</a>
              <a href="#" className="hover:text-accent">Facebook</a>
              <a href="#" className="hover:text-accent">X</a>
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground/50">{section}</h3>
              <ul className="mt-4 space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-foreground/70 hover:text-accent">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-foreground/50 sm:flex-row">
          <p>© {new Date().getFullYear()} LuxeLoom. All rights reserved.</p>
          <p>Made for the Indian wardrobe.</p>
        </div>
      </div>
    </footer>
  );
}
