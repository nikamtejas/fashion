"use client";

import * as React from "react";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-[7rem] leading-none tracking-tight">
        <span className="text-sienna">!</span>
      </p>
      <h1 className="font-display mt-2 text-2xl">Something went wrong</h1>
      <p className="mt-2 text-sm text-foreground/60">
        That&rsquo;s on us, not you — the page hit an unexpected error. Try again, or head back home.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-ivory dark:bg-ivory dark:text-ink"
        >
          Try again
        </button>
        <Link href="/" className="rounded-full border border-border px-6 py-3 text-sm font-medium">
          Go home
        </Link>
      </div>
    </div>
  );
}
