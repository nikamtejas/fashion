"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Drawer } from "@/components/ui/Drawer";
import { cn } from "@/lib/utils";

type StaffRole = "ADMIN" | "OPS" | "CATALOG";

// Mirrors the backend's requireOps/requireCatalog/requireAdmin grouping on
// each admin*.routes.ts file — kept in sync manually since the frontend has
// no way to introspect the backend's route table. ADMIN can reach
// everything; OPS/CATALOG are each scoped to their own section.
const NAV_LINKS: { href: string; label: string; roles: StaffRole[] }[] = [
  { href: "/admin", label: "Dashboard", roles: ["ADMIN", "OPS"] },
  { href: "/admin/pos", label: "POS", roles: ["ADMIN", "OPS"] },
  { href: "/admin/products", label: "Products", roles: ["ADMIN", "CATALOG"] },
  { href: "/admin/inventory", label: "Inventory", roles: ["ADMIN", "OPS"] },
  { href: "/admin/orders", label: "Orders", roles: ["ADMIN", "OPS"] },
  { href: "/admin/invoices", label: "Invoices", roles: ["ADMIN"] },
  { href: "/admin/cod-remittance", label: "COD remittance", roles: ["ADMIN", "OPS"] },
  { href: "/admin/returns", label: "Returns", roles: ["ADMIN", "OPS"] },
  { href: "/admin/refunds", label: "Refund payouts", roles: ["ADMIN", "OPS"] },
  { href: "/admin/customers", label: "Customers", roles: ["ADMIN", "OPS"] },
  { href: "/admin/support", label: "Support", roles: ["ADMIN", "OPS"] },
  { href: "/admin/lookbooks", label: "Lookbooks", roles: ["ADMIN", "CATALOG"] },
  { href: "/admin/newsletter", label: "Newsletter", roles: ["ADMIN"] },
  { href: "/admin/reviews", label: "Reviews", roles: ["ADMIN", "OPS"] },
  { href: "/admin/coupons", label: "Coupons", roles: ["ADMIN"] },
  { href: "/admin/pickups", label: "Pickups", roles: ["ADMIN", "OPS"] },
  { href: "/admin/stores", label: "Stores", roles: ["ADMIN", "OPS"] },
  { href: "/admin/settings", label: "Settings", roles: ["ADMIN"] },
];

/** Default landing page per role — /admin itself is Dashboard-only (OPS+
 * ADMIN), so a CATALOG user needs a different fallback. Just picks each
 * role's first allowed link. */
function defaultPathFor(role: StaffRole): string {
  return NAV_LINKS.find((l) => l.roles.includes(role))?.href ?? "/admin";
}

// "/admin" is a prefix of every other admin path, so it needs an exact
// match — otherwise the Dashboard link's mere presence in NAV_LINKS would
// authorize every other page for anyone who can see the dashboard.
function matchesLink(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

const STAFF_ROLES: StaffRole[] = ["ADMIN", "OPS", "CATALOG"];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const isStaff = !!user && (STAFF_ROLES as string[]).includes(user.role);
  const links = isStaff ? NAV_LINKS.filter((l) => l.roles.includes(user!.role as StaffRole)) : [];

  React.useEffect(() => {
    if (!loading && !isStaff) {
      router.replace("/login?callbackUrl=/admin");
    }
  }, [loading, isStaff, router]);

  // The backend already rejects this role's requests on a page outside its
  // section (403), but the page itself would otherwise render fully broken
  // — empty tables, failed actions, no explanation. Bounce OPS/CATALOG
  // straight to their own landing page instead of showing that.
  React.useEffect(() => {
    if (!isStaff || !user) return;
    const allowed = NAV_LINKS.some((l) => l.roles.includes(user.role as StaffRole) && matchesLink(pathname, l.href));
    if (!allowed) router.replace(defaultPathFor(user.role as StaffRole));
  }, [isStaff, user, pathname, router]);

  // Route changed (a nav link was followed) — close the mobile drawer so it
  // doesn't stay open over the next page.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    return matchesLink(pathname, href);
  }

  // Only the content area waits on auth — the header/nav shell is static
  // (no data dependency) and mounting it immediately means the page doesn't
  // swap its whole structure once the auth check resolves. The redirect
  // effect above still fires the moment a non-staff user is detected.
  const ready = !loading && isStaff;

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
            {links.map((link) => (
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
          {links.map((link) => (
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
