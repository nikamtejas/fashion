"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listProducts, deleteProduct, type Product } from "@/lib/products";
import { ApiRequestError } from "@/lib/api";

const PAGE_SIZE = 20;

export default function ProductsPage() {
  const [items, setItems] = useState<Product[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (targetPage: number) => {
    setItems(null);
    setError(null);
    try {
      const res = await listProducts({ page: targetPage, limit: PAGE_SIZE });
      setItems(res.items);
      setTotal(res.total);
      setPage(res.page);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to load products");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    // Loading the first page of products on mount — subscribing to backend state,
    // not deriving it from props/state (see the rule's own guidance).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(1);
  }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this product? This also removes its images from Cloudinary.")) return;
    setDeletingId(id);
    try {
      await deleteProduct(id);
      await load(page);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to delete product");
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">{total} total</p>
        </div>
        <Link
          href="/products/new"
          className="h-10 rounded-full bg-black px-4 text-sm font-medium leading-10 text-white dark:bg-white dark:text-black"
        >
          + New product
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-black/50 dark:border-white/10 dark:text-white/50">
              <th className="py-2 pr-3 font-medium">Image</th>
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="py-2 pr-3 font-medium">Category</th>
              <th className="py-2 pr-3 font-medium">Stock</th>
              <th className="py-2 pr-3 font-medium">Price</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items === null &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-3 pr-3" colSpan={7}>
                    <div className="h-10 w-full animate-pulse rounded bg-black/10 dark:bg-white/10" />
                  </td>
                </tr>
              ))}

            {items !== null && items.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-black/50 dark:text-white/50">
                  No products yet.
                </td>
              </tr>
            )}

            {items?.map((product) => {
              const thumb = product.images.find((img) => img.isPrimary) ?? product.images[0];
              const thumbUrl = thumb ? (thumb.status === "accepted" ? thumb.enhancedUrl : thumb.originalUrl) : null;
              return (
                <tr key={product._id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 pr-3">
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- small admin table thumbnail
                      <img src={thumbUrl} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-black/10 dark:bg-white/10" />
                    )}
                  </td>
                  <td className="py-2 pr-3 font-medium">{product.name}</td>
                  <td className="py-2 pr-3 text-black/70 dark:text-white/70">{product.category}</td>
                  <td className="py-2 pr-3">{product.stock}</td>
                  <td className="py-2 pr-3">₹{product.pricing.finalPrice.toFixed(2)}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        product.status === "published"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60"
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex gap-3">
                      <Link href={`/products/${product._id}/edit`} className="font-medium underline underline-offset-2">
                        Edit
                      </Link>
                      <button
                        type="button"
                        disabled={deletingId === product._id}
                        onClick={() => handleDelete(product._id)}
                        className="font-medium text-red-600 disabled:opacity-50"
                      >
                        {deletingId === product._id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => load(page - 1)}
            className="rounded-full border border-black/15 px-3 py-1 disabled:opacity-40 dark:border-white/20"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => load(page + 1)}
            className="rounded-full border border-black/15 px-3 py-1 disabled:opacity-40 dark:border-white/20"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
