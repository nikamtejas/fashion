"use client";

import * as React from "react";
import { Mail, Send, Users } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface Campaign {
  _id: string;
  subject: string;
  body: string;
  recipientCount: number;
  sentBy?: { name?: string; email?: string };
  createdAt: string;
}

const textareaClass =
  "min-h-40 w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent";

export default function AdminNewsletterPage() {
  const { toast } = useToast();
  const [subscriberCount, setSubscriberCount] = React.useState<number | null>(null);
  const [campaigns, setCampaigns] = React.useState<Campaign[] | null>(null);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const load = React.useCallback(() => {
    apiFetch<{ subscriberCount: number; campaigns: Campaign[] }>("/api/admin/newsletter").then((data) => {
      setSubscriberCount(data.subscriberCount);
      setCampaigns(data.campaigns);
    });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleSend() {
    setSending(true);
    try {
      await apiFetch<{ campaign: Campaign }>("/api/admin/newsletter/send", {
        method: "POST",
        json: { subject, body },
      });
      toast({ title: `Sent to ${subscriberCount} subscriber${subscriberCount === 1 ? "" : "s"}`, variant: "success" });
      setSubject("");
      setBody("");
      setConfirmOpen(false);
      load();
    } catch (err) {
      toast({ title: "Couldn't send", description: err instanceof ApiError ? err.message : undefined, variant: "error" });
    } finally {
      setSending(false);
    }
  }

  const canSend = subject.trim().length >= 3 && body.trim().length >= 10 && (subscriberCount ?? 0) > 0;

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl">Newsletter</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Compose an email and send it to everyone subscribed via the site footer.
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-sm">
        <Users className="h-4 w-4 text-accent" />
        {subscriberCount === null ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <span>
            <span className="font-medium">{subscriberCount}</span> subscriber{subscriberCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="mt-6 space-y-4 rounded-2xl border border-border p-4">
        <Input label="Subject" required maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="New drops this Friday" />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-foreground/70">Message</label>
          <textarea
            className={textareaClass}
            required
            maxLength={20000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Write your update here — separate paragraphs with a blank line.\n\nThis goes out through the same branded template as order emails."}
          />
        </div>
        <Button disabled={!canSend} onClick={() => setConfirmOpen(true)}>
          <Send className="h-4 w-4" /> Send to {subscriberCount ?? 0} subscriber{subscriberCount === 1 ? "" : "s"}
        </Button>
      </div>

      <h2 className="mt-10 font-display text-xl">Sent campaigns</h2>
      {campaigns === null ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : campaigns.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/50">Nothing sent yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {campaigns.map((c) => (
            <div key={c._id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-3.5 w-3.5 text-foreground/40" /> {c.subject}
                </p>
                <p className="text-xs text-foreground/50">
                  {new Date(c.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-foreground/60">{c.body}</p>
              <p className="mt-2 text-[11px] uppercase tracking-wider text-foreground/40">
                Sent to {c.recipientCount} subscriber{c.recipientCount === 1 ? "" : "s"}
                {c.sentBy?.name || c.sentBy?.email ? ` · by ${c.sentBy.name ?? c.sentBy.email}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Send this newsletter?"
        description={`This emails ${subscriberCount ?? 0} subscriber${subscriberCount === 1 ? "" : "s"} right away — this can't be undone.`}
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-sm font-medium">{subject}</p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/60">{body}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" magnetic={false} className="flex-1" onClick={() => setConfirmOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSend} disabled={sending}>
              {sending ? "Sending…" : "Yes, send it"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
