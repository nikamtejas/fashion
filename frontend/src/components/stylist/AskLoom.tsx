"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X, Send } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  products?: { slug: string; name: string; price: number; image: string | null; inStock: boolean }[];
}

const OPENERS = ["What should I wear to a beach wedding?", "Build me a café date outfit", "Something for golden hour photos"];

export function AskLoom() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const data = await apiFetch<{ reply: string; products: ChatMessage["products"] }>("/api/stylist/chat", {
        method: "POST",
        json: { messages: next.map((m) => ({ role: m.role, content: m.content })) },
      });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, products: data.products }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Loom hit a snag — try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Ask Loom, the AI stylist"
        // Below lg, the product page's sticky "Add to bag" bar sits flush
        // against the bottom edge — clear it instead of floating on top of
        // it. Only that page has a bottom bar today, but keeping this
        // offset global (rather than page-aware) is simpler and the extra
        // clearance elsewhere is barely noticeable.
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-ivory shadow-xl transition-transform hover:scale-105 dark:bg-ivory dark:text-ink lg:bottom-5"
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed bottom-44 right-5 z-40 flex h-[520px] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl lg:bottom-24"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="font-display text-lg">Ask Loom</p>
              <p className="text-xs text-foreground/50">Your AI stylist — answers come with shoppable picks</p>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-foreground/50">Try one of these:</p>
                  {OPENERS.map((o) => (
                    <button
                      key={o}
                      onClick={() => send(o)}
                      className="block w-full rounded-xl border border-border px-3 py-2 text-left text-xs hover:border-accent"
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={cn("max-w-[85%]", m.role === "user" ? "ml-auto" : "")}>
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm",
                      m.role === "user" ? "bg-ink text-ivory dark:bg-ivory dark:text-ink" : "bg-foreground/5"
                    )}
                  >
                    {m.content}
                  </div>
                  {m.products && m.products.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {m.products.map((p) => (
                        <Link
                          key={p.slug}
                          href={`/products/${p.slug}`}
                          onClick={() => setOpen(false)}
                          className="overflow-hidden rounded-xl border border-border bg-background"
                        >
                          <div className="relative aspect-[3/4] bg-foreground/5">
                            {p.image && <Image src={p.image} alt={p.name} fill sizes="160px" className="object-cover" />}
                          </div>
                          <div className="p-2">
                            <p className="truncate text-xs font-medium">{p.name}</p>
                            <p className="text-[11px] text-foreground/50">₹{p.price.toLocaleString("en-IN")}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {busy && (
                <div className="flex gap-1 px-2 py-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex gap-2 border-t border-border p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about an occasion, a fit…"
                aria-label="Message Loom"
                className="h-10 flex-1 rounded-full border border-border bg-background px-4 text-sm"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-sienna text-white disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
