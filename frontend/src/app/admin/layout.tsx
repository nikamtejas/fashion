"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Drawer } from "@/components/ui/Drawer";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/pos", label: "POS" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/invoices", label: "Invoices" },
  { href: "/admin/cod-remittance", label: "COD remittance" },
  { href: "/admin/returns", label: "Returns" },
  { href: "/admin/refunds", label: "Refund payouts" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/lookbooks", label: "Lookbooks" },
  { href: "/admin/newsletter", label: "Newsletter" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/pickups", label: "Pickups" },
  { href: "/admin/stores", label: "Stores" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    if (!loading && (!user || user.role !== "ADMIN")) {
      router.replace("/login?callbackUrl=/admin");
    }
  }, [loading, user, router]);

  // Route changed (a nav link was followed) — close the mobile drawer so it
  // doesn't stay open over the next page.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  }

  // Only the content area waits on auth — the header/nav shell is static
  // (no data dependency) and mounting it immediately means the page doesn't
  // swap its whole structure once the auth check resolves. The redirect
  // effect above still fires the moment a non-admin is detected.
  const ready = !loading && !!user && user.role === "ADMIN";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-6 border-b border-border pb-4 sm:mb-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/admin" className="font-display text-lg sm:text-xl">
            LuxeLoom Admin
          </Link>

          {/* 17 links can't sit in one readable row below lg (1024px) — a
              tablet in portrait would wrap them into 3-4 cramped rows above
              the fold on every admin page. Collapse into a drawer instead. */}
          <button
            className="rounded-full p-2 text-foreground/70 hover:bg-foreground/5 hover:text-foreground lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <nav className="hidden flex-wrap gap-x-5 gap-y-2 text-sm text-foreground/60 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn("hover:text-foreground", isActive(link.href) && "font-medium text-foreground")}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* A fixed-overlay drawer instead of an inline-flow panel — the old
          version rendered the link grid directly in the page body, so
          opening it on mobile shoved every list/table below down the page
          (and snapped back up on close) instead of floating over it. */}
      <Drawer open={mobileOpen} onOpenChange={setMobileOpen} title="Menu" side="left">
        <nav className="flex flex-col gap-1 text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2.5 text-foreground/70 hover:bg-foreground/5 hover:text-foreground",
                isActive(link.href) && "bg-foreground/5 font-medium text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </Drawer>

      {ready ? (
        children
      ) : (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-foreground/50">
          Checking access…
        </div>
      )}
    </div>
  );
}
