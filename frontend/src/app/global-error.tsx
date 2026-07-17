"use client";

import * as React from "react";
import Link from "next/link";

/** Last-resort boundary — only fires if the root layout itself throws
 * (e.g. a provider crashing during render), which the regular error.tsx
 * can't catch since it renders inside that same layout. Deliberately
 * self-contained (own <html>/<body>, no imports from the app's component
 * tree or providers) since whatever's broken might be one of those. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 16px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>Something went wrong</h1>
          <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "32px", maxWidth: "360px" }}>
            That&rsquo;s on us, not you — the page hit an unexpected error. Try again, or head back home.
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => reset()}
              style={{
                borderRadius: "9999px",
                background: "#141414",
                color: "#FAF7F2",
                padding: "12px 24px",
                fontSize: "0.875rem",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{
                borderRadius: "9999px",
                border: "1px solid #ddd",
                padding: "12px 24px",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
