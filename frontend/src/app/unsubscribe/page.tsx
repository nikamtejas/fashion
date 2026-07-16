"use client";

import * as React from "react";
import Link from "next/link";
import { MailX } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function UnsubscribePage() {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch("/api/newsletter/subscribe", { method: "DELETE", json: { email } });
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <MailX className="mx-auto h-8 w-8 text-foreground/40" />
      {done ? (
        <>
          <h1 className="font-display mt-4 text-2xl">You&rsquo;re unsubscribed</h1>
          <p className="mt-2 text-sm text-foreground/60">
            {email} won&rsquo;t receive any more newsletter emails from us. You can{" "}
            <Link href="/" className="text-accent underline underline-offset-2">
              resubscribe anytime
            </Link>{" "}
            from the site footer.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-display mt-4 text-2xl">Unsubscribe</h1>
          <p className="mt-2 text-sm text-foreground/60">
            Enter the email address you subscribed with and we&rsquo;ll stop sending newsletter emails to it.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
            <Input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" disabled={busy || !email}>
              {busy ? "Unsubscribing…" : "Unsubscribe"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
