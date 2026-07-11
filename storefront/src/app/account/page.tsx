"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function AccountPage() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-4 py-12 sm:px-6">
        <div className="h-6 w-40 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="h-4 w-64 animate-pulse rounded bg-black/10 dark:bg-white/10" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4 py-12 sm:px-6">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">My account</h1>
        <dl className="mt-6 divide-y divide-black/10 text-sm dark:divide-white/10">
          <Row label="Name" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Phone" value={user.phone ?? "—"} />
        </dl>

        <div className="mt-6 flex flex-col gap-1">
          <Link
            href="/account/orders"
            className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
          >
            My orders
          </Link>
          <Link
            href="/account/wishlist"
            className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
          >
            My wishlist
          </Link>
        </div>

        <button
          type="button"
          onClick={() => logout()}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-full border border-black/15 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Log out
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <dt className="text-black/60 dark:text-white/60">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
