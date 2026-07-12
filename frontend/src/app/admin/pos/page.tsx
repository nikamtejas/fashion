"use client";

import * as React from "react";
import Image from "next/image";
import { Plus, Minus, Trash2, Printer, FileText } from "lucide-react";
import { apiFetch, API_URL } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface PosProduct {
  id: string;
  name: string;
  image: string | null;
  price: number;
  variants: { sku: string; size: string; color: string; stock: number }[];
}

interface PosLine {
  productId: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  price: number;
  qty: number;
  stock: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function PosPage() {
  const { toast } = useToast();
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<PosProduct[]>([]);
  const [lines, setLines] = React.useState<PosLine[]>([]);
  const [discount, setDiscount] = React.useState(0);
  const [mode, setMode] = React.useState<"CASH" | "CARD" | "UPI">("CASH");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<{ orderId: string; orderNumber: string; invoiceNumber: string; total: number } | null>(null);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      // Debounced product lookup; setState in the async callback.
       
      apiFetch<{ products: PosProduct[] }>(`/api/admin/pos/products?q=${encodeURIComponent(q)}`)
        .then((d) => setResults(d.products))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [q]);

  function addLine(p: PosProduct, sku: string) {
    const v = p.variants.find((x) => x.sku === sku);
    if (!v || v.stock < 1) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.sku === sku);
      if (existing) {
        return prev.map((l) => (l.sku === sku && l.qty < l.stock ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { productId: p.id, sku, name: p.name, size: v.size, color: v.color, price: p.price, qty: 1, stock: v.stock }];
    });
  }

  const subtotal = round2(lines.reduce((s, l) => s + l.price * l.qty, 0));
  const cappedDiscount = Math.min(discount, subtotal);
  const total = round2(subtotal - cappedDiscount);

  async function completeSale() {
    setBusy(true);
    try {
      const data = await apiFetch<{ order: { _id: string; orderNumber: string; pricing: { total: number } }; invoice: { invoiceNumber: string } }>(
        "/api/admin/pos/sale",
        {
          method: "POST",
          json: {
            items: lines.map((l) => ({ productId: l.productId, sku: l.sku, qty: l.qty })),
            discount: cappedDiscount,
            paymentMode: mode,
            customerNote: note || undefined,
          },
        }
      );
      setDone({
        orderId: data.order._id,
        orderNumber: data.order.orderNumber,
        invoiceNumber: data.invoice.invoiceNumber,
        total: data.order.pricing.total,
      });
      setLines([]);
      setDiscount(0);
      setNote("");
    } catch (err) {
      toast({ title: "Sale failed", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="font-display text-3xl">Sale complete</p>
        <p className="mt-2 text-sm text-foreground/60">
          {done.orderNumber} · Invoice {done.invoiceNumber} · ₹{done.total.toLocaleString("en-IN")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild magnetic={false}>
            <a href={`${API_URL}/api/orders/${done.orderId}/invoice.pdf?format=thermal`} target="_blank" rel="noreferrer">
              <Printer className="h-4 w-4" /> Print receipt (80mm)
            </a>
          </Button>
          <Button variant="outline" magnetic={false} asChild>
            <a href={`${API_URL}/api/orders/${done.orderId}/invoice.pdf`} target="_blank" rel="noreferrer">
              <FileText className="h-4 w-4" /> A4 invoice
            </a>
          </Button>
        </div>
        <Button variant="ghost" className="mt-6" magnetic={false} onClick={() => setDone(null)}>
          New sale
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="font-display text-2xl">POS — walk-in sale</h1>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products…"
          className="mt-4 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
        />
        <div className="mt-4 space-y-3">
          {results.map((p) => (
            <div key={p.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-md bg-foreground/5">
                  {p.image && <Image src={p.image} alt={p.name} fill className="object-cover" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-foreground/50">₹{p.price.toLocaleString("en-IN")}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.variants.map((v) => (
                  <button
                    key={v.sku}
                    disabled={v.stock < 1}
                    onClick={() => addLine(p, v.sku)}
                    className={cn(
                      "rounded-full border border-border px-2.5 py-1 text-[11px] hover:border-accent",
                      v.stock < 1 && "opacity-40"
                    )}
                  >
                    {v.size}/{v.color} ({v.stock})
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="h-fit rounded-2xl border border-border bg-surface p-4 lg:sticky lg:top-24">
        <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Bill</p>
        {lines.length === 0 && <p className="mt-4 text-xs text-foreground/40">Add items from the left.</p>}
        <ul className="mt-3 space-y-2">
          {lines.map((l) => (
            <li key={l.sku} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {l.name} <span className="text-xs text-foreground/50">{l.size}/{l.color}</span>
              </span>
              <button onClick={() => setLines((prev) => prev.map((x) => (x.sku === l.sku && x.qty > 1 ? { ...x, qty: x.qty - 1 } : x)))} className="rounded p-1 text-foreground/50 hover:text-foreground">
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-5 text-center tabular-nums">{l.qty}</span>
              <button
                onClick={() => setLines((prev) => prev.map((x) => (x.sku === l.sku && x.qty < x.stock ? { ...x, qty: x.qty + 1 } : x)))}
                className="rounded p-1 text-foreground/50 hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
              </button>
              <span className="w-16 text-right tabular-nums">₹{round2(l.price * l.qty).toLocaleString("en-IN")}</span>
              <button onClick={() => setLines((prev) => prev.filter((x) => x.sku !== l.sku))} className="rounded p-1 text-foreground/40 hover:text-red-600">
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>

        {lines.length > 0 && (
          <>
            <div className="my-3 h-px bg-border" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground/60">Subtotal</span>
              <span className="tabular-nums">₹{subtotal.toLocaleString("en-IN")}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-sm">
              <span className="text-foreground/60">Discount ₹</span>
              <input
                type="number"
                min={0}
                value={discount || ""}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                className="h-8 w-24 rounded-lg border border-border bg-background px-2 text-right text-sm tabular-nums"
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-base font-medium">
              <span>Total</span>
              <span className="tabular-nums">₹{total.toLocaleString("en-IN")}</span>
            </div>

            <div className="mt-3 flex gap-2">
              {(["CASH", "CARD", "UPI"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex-1 rounded-lg border px-2 py-2 text-xs font-medium",
                    mode === m ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground/60"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Customer note (optional)"
              className="mt-2 h-9 w-full rounded-lg border border-border bg-background px-2 text-xs"
            />
            <Button className="mt-4 w-full" size="lg" disabled={busy} onClick={completeSale}>
              {busy ? "Completing…" : `Charge ₹${total.toLocaleString("en-IN")} (${mode})`}
            </Button>
          </>
        )}
      </aside>
    </div>
  );
}
