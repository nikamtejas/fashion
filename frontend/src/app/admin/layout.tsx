"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && (!user || user.role !== "ADMIN")) {
      router.replace("/login?callbackUrl=/admin");
    }
  }, [loading, user, router]);

  if (loading || !user || user.role !== "ADMIN") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-foreground/50">
        Checking access…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-6 border-b border-border pb-4">
        <Link href="/admin" className="font-display text-xl">
          LuxeLoom Admin
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm text-foreground/60">
          <Link href="/admin" className="hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/admin/pos" className="hover:text-foreground">
            POS
          </Link>
          <Link href="/admin/products" className="hover:text-foreground">
            Products
          </Link>
          <Link href="/admin/inventory" className="hover:text-foreground">
            Inventory
          </Link>
          <Link href="/admin/orders" className="hover:text-foreground">
            Orders
          </Link>
          <Link href="/admin/invoices" className="hover:text-foreground">
            Invoices
          </Link>
          <Link href="/admin/returns" className="hover:text-foreground">
            Returns
          </Link>
          <Link href="/admin/customers" className="hover:text-foreground">
            Customers
          </Link>
          <Link href="/admin/lookbooks" className="hover:text-foreground">
            Lookbooks
          </Link>
          <Link href="/admin/reviews" className="hover:text-foreground">
            Reviews
          </Link>
          <Link href="/admin/coupons" className="hover:text-foreground">
            Coupons
          </Link>
          <Link href="/admin/pickups" className="hover:text-foreground">
            Pickups
          </Link>
          <Link href="/admin/stores" className="hover:text-foreground">
            Stores
          </Link>
          <Link href="/admin/settings" className="hover:text-foreground">
            Settings
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
