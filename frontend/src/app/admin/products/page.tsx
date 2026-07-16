"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

interface AdminProduct {
  _id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  images: { publicId: string; secureUrl: string; thumbUrl?: string; type: string }[];
  pricing?: { finalPrice?: number };
  category?: { name: string };
  createdAt: string;
}

export default function AdminProductsPage() {
  const [products, setProducts] = React.useState<AdminProduct[] | null>(null);

  React.useEffect(() => {
    apiFetch<{ products: AdminProduct[] }>("/api/admin/products").then((data) => setProducts(data.products));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Products</h1>
        <Button asChild>
          <Link href="/admin/products/new">New product</Link>
        </Button>
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-foreground/50">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {products === null &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-3" colSpan={4}>
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))}
            {products?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-foreground/50">
                  No products yet — create your first one.
                </td>
              </tr>
            )}
            {products?.map((p) => (
              <tr key={p._id} className="border-t border-border hover:bg-foreground/5">
                <td className="px-4 py-3">
                  <Link href={`/admin/products/new?id=${p._id}`} className="flex items-center gap-3">
                    <div className="relative h-12 w-10 overflow-hidden rounded-md bg-foreground/5">
                      {p.images?.[0] && (
                        <Image src={p.images[0].thumbUrl ?? p.images[0].secureUrl} alt={p.name} fill sizes="40px" className="object-cover" />
                      )}
                    </div>
                    <span className="font-medium">{p.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground/60">{p.category?.name ?? "—"}</td>
                <td className="px-4 py-3">₹{(p.pricing?.finalPrice ?? 0).toLocaleString("en-IN")}</td>
                <td className="px-4 py-3">
                  <Badge variant={p.status === "PUBLISHED" ? "success" : "outline"}>{p.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
