import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-[7rem] leading-none tracking-tight">
        4<span className="text-sienna">0</span>4
      </p>
      <h1 className="font-display mt-2 text-2xl">This look doesn&rsquo;t exist</h1>
      <p className="mt-2 text-sm text-foreground/60">
        The page you&rsquo;re after has been retired from the collection — but the racks are full.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/shop"
          className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-ivory dark:bg-ivory dark:text-ink"
        >
          Browse the shop
        </Link>
        <Link href="/" className="rounded-full border border-border px-6 py-3 text-sm font-medium">
          Go home
        </Link>
      </div>
    </div>
  );
}
