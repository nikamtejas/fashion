"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "ORDER", label: "Order issue" },
  { value: "REFUND", label: "Refunds & returns" },
  { value: "PAYMENT", label: "Payment" },
  { value: "PRODUCT", label: "Product question" },
  { value: "OTHER", label: "Something else" },
] as const;

interface TicketSummary {
  _id: string;
  subject: string;
  category: string;
  status: "OPEN" | "RESOLVED";
  lastMessageAt: string;
  messageCount: number;
  lastMessage: { sender: "CUSTOMER" | "SUPPORT"; body: string } | null;
}

interface TicketMessage {
  _id: string;
  sender: "CUSTOMER" | "SUPPORT";
  body: string;
  createdAt: string;
}

interface TicketDetail {
  _id: string;
  subject: string;
  category: string;
  status: "OPEN" | "RESOLVED";
  messages: TicketMessage[];
  order?: { orderNumber: string };
}

interface OrderOption {
  _id: string;
  orderNumber: string;
}

function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

const textareaClass =
  "min-h-24 w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent";

const selectClass =
  "h-12 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function SupportSection() {
  const { toast } = useToast();
  const [tickets, setTickets] = React.useState<TicketSummary[] | null>(null);
  const [view, setView] = React.useState<"list" | "new" | "thread">("list");
  const [ticket, setTicket] = React.useState<TicketDetail | null>(null);

  const [subject, setSubject] = React.useState("");
  const [category, setCategory] = React.useState<string>("ORDER");
  const [orderId, setOrderId] = React.useState("");
  const [orders, setOrders] = React.useState<OrderOption[]>([]);
  const [message, setMessage] = React.useState("");
  const [reply, setReply] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const loadTickets = React.useCallback(async () => {
    const data = await apiFetch<{ tickets: TicketSummary[] }>("/api/support");
    setTickets(data.tickets);
  }, []);

  React.useEffect(() => {
    loadTickets();
    apiFetch<{ orders: OrderOption[] }>("/api/orders")
      .then((data) => setOrders(data.orders))
      .catch(() => setOrders([]));
  }, [loadTickets]);

  // Light poll while a thread is open so support replies appear like chat.
  React.useEffect(() => {
    if (view !== "thread" || !ticket) return;
    const id = setInterval(async () => {
      try {
        const data = await apiFetch<{ ticket: TicketDetail }>(`/api/support/${ticket._id}`);
        setTicket(data.ticket);
      } catch {
        // transient — next tick retries
      }
    }, 15_000);
    return () => clearInterval(id);
  }, [view, ticket?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openTicket(id: string) {
    const data = await apiFetch<{ ticket: TicketDetail }>(`/api/support/${id}`);
    setTicket(data.ticket);
    setView("thread");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await apiFetch<{ ticket: TicketDetail }>("/api/support", {
        method: "POST",
        json: { subject, category, message, ...(orderId ? { orderId } : {}) },
      });
      setSubject("");
      setMessage("");
      setOrderId("");
      await loadTickets();
      setTicket(data.ticket);
      setView("thread");
      toast({ title: "Message sent", description: "Our support team will reply here.", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't send", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || !reply.trim()) return;
    setBusy(true);
    try {
      const data = await apiFetch<{ ticket: TicketDetail }>(`/api/support/${ticket._id}/messages`, {
        method: "POST",
        json: { message: reply },
      });
      setTicket(data.ticket);
      setReply("");
    } catch (err) {
      toast({ title: "Couldn't send", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (tickets === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (view === "new") {
    return (
      <form onSubmit={handleCreate} className="space-y-4 rounded-2xl border border-border p-5">
        <button type="button" onClick={() => setView("list")} className="flex items-center gap-1 text-xs text-foreground/50 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All conversations
        </button>
        <Input label="Subject" required maxLength={120} placeholder="e.g. Where is my refund?" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-foreground/70">Topic</label>
            <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-foreground/70">Related order (optional)</label>
            <select className={selectClass} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">None</option>
              {orders.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.orderNumber}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-foreground/70">How can we help?</label>
          <textarea className={textareaClass} required maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us what happened — refunds, order changes, sizing, anything." />
        </div>
        <Button type="submit" size="sm" disabled={busy} magnetic={false}>
          {busy ? "Sending…" : "Start conversation"}
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    );
  }

  if (view === "thread" && ticket) {
    return (
      <div className="rounded-2xl border border-border">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <button onClick={() => { setView("list"); loadTickets(); }} className="flex items-center gap-1 text-xs text-foreground/50 hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> All conversations
            </button>
            <p className="mt-1 text-sm font-medium">{ticket.subject}</p>
            <p className="text-xs text-foreground/50">
              {categoryLabel(ticket.category)}
              {ticket.order ? ` · ${ticket.order.orderNumber}` : ""}
            </p>
          </div>
          <Badge variant={ticket.status === "RESOLVED" ? "success" : "outline"}>{ticket.status}</Badge>
        </div>

        <div className="max-h-96 space-y-3 overflow-y-auto p-4">
          {ticket.messages.map((m) => (
            <div key={m._id} className={cn("flex", m.sender === "CUSTOMER" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                  m.sender === "CUSTOMER" ? "rounded-br-sm bg-ink text-ivory dark:bg-ivory dark:text-ink" : "rounded-bl-sm bg-foreground/5"
                )}
              >
                {m.sender === "SUPPORT" && <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">LuxeLoom Support</p>}
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={cn("mt-1 text-[10px]", m.sender === "CUSTOMER" ? "text-ivory/50 dark:text-ink/50" : "text-foreground/40")}>
                  {new Date(m.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleReply} className="flex items-end gap-2 border-t border-border p-4">
          <textarea
            className={cn(textareaClass, "min-h-12")}
            rows={1}
            placeholder={ticket.status === "RESOLVED" ? "Reply to reopen this conversation…" : "Write a reply…"}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={busy || !reply.trim()} magnetic={false}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground/60">Questions about orders, refunds, payments — chat with our support team.</p>
        <Button size="sm" magnetic={false} onClick={() => setView("new")}>
          <Plus className="h-4 w-4" /> New conversation
        </Button>
      </div>

      <p className="text-xs text-foreground/50">
        Returning an item? Start it directly from{" "}
        <Link href="/account/orders" className="text-accent underline underline-offset-2">
          your orders
        </Link>{" "}
        — then ask here if anything is unclear.
      </p>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
          <MessageCircle className="h-6 w-6 text-foreground/30" />
          <p className="text-sm text-foreground/50">No conversations yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <button
              key={t._id}
              onClick={() => openTicket(t._id)}
              className="block w-full rounded-2xl border border-border p-4 text-left transition-colors hover:border-foreground/30"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{t.subject}</p>
                <Badge variant={t.status === "RESOLVED" ? "success" : "outline"}>{t.status}</Badge>
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-foreground/50">
                {t.lastMessage ? `${t.lastMessage.sender === "SUPPORT" ? "Support: " : "You: "}${t.lastMessage.body}` : "No messages"}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-foreground/40">
                {categoryLabel(t.category)} ·{" "}
                {new Date(t.lastMessageAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
