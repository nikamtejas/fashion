"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AdminTicket {
  _id: string;
  subject: string;
  category: string;
  status: "OPEN" | "RESOLVED";
  lastMessageAt: string;
  user?: { name?: string; email: string; phone?: string };
  order?: { orderNumber: string };
  messages: { _id: string; sender: "CUSTOMER" | "SUPPORT"; body: string; createdAt: string }[];
}

export default function AdminSupportPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = React.useState<AdminTicket[] | null>(null);
  const [filter, setFilter] = React.useState<"OPEN" | "RESOLVED" | "ALL">("OPEN");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [reply, setReply] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const query = filter === "ALL" ? "" : `?status=${filter}`;
    const data = await apiFetch<{ tickets: AdminTicket[] }>(`/api/admin/support${query}`);
    setTickets(data.tickets);
  }, [filter]);

  React.useEffect(() => {
    setTickets(null);
    load();
  }, [load]);

  const selected = tickets?.find((t) => t._id === selectedId) ?? null;

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/support/${selected._id}/reply`, { method: "POST", json: { message: reply } });
      setReply("");
      await load();
    } catch (err) {
      toast({ title: "Couldn't send reply", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: "OPEN" | "RESOLVED") {
    if (!selected) return;
    try {
      await apiFetch(`/api/admin/support/${selected._id}/status`, { method: "PATCH", json: { status } });
      await load();
    } catch (err) {
      toast({ title: "Couldn't update status", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Support inbox</h1>
        <div className="flex gap-1 rounded-full border border-border p-1 text-xs">
          {(["OPEN", "RESOLVED", "ALL"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-3 py-1.5 font-medium",
                filter === f ? "bg-ink text-ivory dark:bg-ivory dark:text-ink" : "text-foreground/60 hover:text-foreground"
              )}
            >
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {tickets === null ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-2">
            {tickets.length === 0 && <p className="text-sm text-foreground/50">No {filter.toLowerCase()} conversations.</p>}
            {tickets.map((t) => (
              <button
                key={t._id}
                onClick={() => setSelectedId(t._id)}
                className={cn(
                  "block w-full rounded-xl border p-3 text-left text-sm transition-colors",
                  selectedId === t._id ? "border-accent bg-accent/5" : "border-border hover:border-foreground/30"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{t.subject}</p>
                  <Badge variant={t.status === "RESOLVED" ? "success" : "outline"}>{t.status}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-foreground/50">
                  {t.user?.name ?? t.user?.email ?? "Customer"} · {t.category}
                  {t.order ? ` · ${t.order.orderNumber}` : ""}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-foreground/40">
                  {t.messages[t.messages.length - 1]?.body}
                </p>
              </button>
            ))}
          </div>

          {selected ? (
            <div className="flex max-h-[70vh] flex-col rounded-2xl border border-border">
              <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                <div>
                  <p className="text-sm font-medium">{selected.subject}</p>
                  <p className="text-xs text-foreground/50">
                    {selected.user?.name ? `${selected.user.name} · ` : ""}
                    {selected.user?.email}
                    {selected.user?.phone ? ` · ${selected.user.phone}` : ""}
                  </p>
                </div>
                {selected.status === "OPEN" ? (
                  <Button size="sm" variant="outline" magnetic={false} onClick={() => setStatus("RESOLVED")}>
                    Mark resolved
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" magnetic={false} onClick={() => setStatus("OPEN")}>
                    Reopen
                  </Button>
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {selected.messages.map((m) => (
                  <div key={m._id} className={cn("flex", m.sender === "SUPPORT" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                        m.sender === "SUPPORT" ? "rounded-br-sm bg-ink text-ivory dark:bg-ivory dark:text-ink" : "rounded-bl-sm bg-foreground/5"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className={cn("mt-1 text-[10px]", m.sender === "SUPPORT" ? "text-ivory/50 dark:text-ink/50" : "text-foreground/40")}>
                        {new Date(m.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleReply} className="flex items-end gap-2 border-t border-border p-4">
                <textarea
                  className="min-h-12 w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  rows={1}
                  placeholder="Reply as LuxeLoom Support…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <Button type="submit" size="sm" disabled={busy || !reply.trim()} magnetic={false}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-border p-10 text-sm text-foreground/40">
              Select a conversation to reply
            </div>
          )}
        </div>
      )}
    </div>
  );
}
