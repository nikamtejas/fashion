"use client";

import * as React from "react";
import { FileText, FolderArchive, Printer } from "lucide-react";
import { apiFetch, API_URL } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

interface RegisterInvoice {
  _id: string;
  invoiceNumber: string;
  total: number;
  cgst: number;
  sgst: number;
  igst: number;
  isPos: boolean;
  createdAt: string;
  order?: { orderNumber: string; deliveryMethod: string; user?: { email: string } };
}

interface GstSummary {
  month: string;
  totals: { invoiceCount: number; grossTotal: number; cgst: number; sgst: number; igst: number };
  byRate: { rate: number; taxableValue: number; cgst: number; sgst: number; igst: number }[];
}

export default function AdminInvoicesPage() {
  const [month, setMonth] = React.useState(new Date().toISOString().slice(0, 7));
  const [invoices, setInvoices] = React.useState<RegisterInvoice[] | null>(null);
  const [summary, setSummary] = React.useState<GstSummary | null>(null);

  React.useEffect(() => {
    // Refetch on month change; setState in the async callbacks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInvoices(null);
    apiFetch<{ invoices: RegisterInvoice[] }>(`/api/admin/invoices?month=${month}`).then((d) => setInvoices(d.invoices));
    apiFetch<GstSummary>(`/api/admin/invoices/gst-summary?month=${month}`).then(setSummary).catch(() => setSummary(null));
  }, [month]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Invoice register</h1>
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm" />
          <a
            href={`${API_URL}/api/admin/invoices/export.zip?month=${month}`}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:border-accent hover:text-accent"
          >
            <FolderArchive className="h-3.5 w-3.5" /> Export ZIP
          </a>
        </div>
      </div>

      {summary && summary.totals.invoiceCount > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">
            GST output tax — {summary.month} ({summary.totals.invoiceCount} invoices, ₹
            {summary.totals.grossTotal.toLocaleString("en-IN")} gross)
          </p>
          <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead className="text-left uppercase tracking-wider text-foreground/40">
              <tr>
                <th className="py-1">Rate</th>
                <th className="py-1">Taxable value</th>
                <th className="py-1">CGST</th>
                <th className="py-1">SGST</th>
                <th className="py-1">IGST</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {summary.byRate.map((r) => (
                <tr key={r.rate} className="border-t border-border/60">
                  <td className="py-1.5">{r.rate}%</td>
                  <td className="py-1.5">₹{r.taxableValue.toLocaleString("en-IN")}</td>
                  <td className="py-1.5">₹{r.cgst.toLocaleString("en-IN")}</td>
                  <td className="py-1.5">₹{r.sgst.toLocaleString("en-IN")}</td>
                  <td className="py-1.5">₹{r.igst.toLocaleString("en-IN")}</td>
                </tr>
              ))}
              <tr className="border-t border-border font-medium">
                <td className="py-1.5">Total</td>
                <td />
                <td className="py-1.5">₹{summary.totals.cgst.toLocaleString("en-IN")}</td>
                <td className="py-1.5">₹{summary.totals.sgst.toLocaleString("en-IN")}</td>
                <td className="py-1.5">₹{summary.totals.igst.toLocaleString("en-IN")}</td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      )}

      {invoices === null && <Skeleton className="mt-6 h-48 w-full" />}
      {invoices?.length === 0 && <p className="mt-8 text-sm text-foreground/50">No invoices in this month.</p>}

      {invoices && invoices.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wider text-foreground/50">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Tax</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv._id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium">
                    {inv.invoiceNumber}
                    {inv.isPos && <span className="ml-1 rounded-full bg-foreground/5 px-1.5 text-[10px]">POS</span>}
                  </td>
                  <td className="px-4 py-2.5 text-foreground/60">{inv.order?.orderNumber}</td>
                  <td className="px-4 py-2.5 text-foreground/60">{inv.order?.user?.email ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs tabular-nums text-foreground/60">
                    {inv.igst > 0 ? `IGST ₹${inv.igst}` : `C ₹${inv.cgst} + S ₹${inv.sgst}`}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">₹{inv.total.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex justify-end gap-1">
                      <a
                        href={`${API_URL}/api/admin/invoices/${inv._id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        title="A4 PDF"
                        className="rounded-lg p-1.5 text-foreground/50 hover:bg-foreground/5"
                      >
                        <FileText className="h-4 w-4" />
                      </a>
                      <a
                        href={`${API_URL}/api/admin/invoices/${inv._id}/pdf?format=thermal`}
                        target="_blank"
                        rel="noreferrer"
                        title="80mm thermal"
                        className="rounded-lg p-1.5 text-foreground/50 hover:bg-foreground/5"
                      >
                        <Printer className="h-4 w-4" />
                      </a>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
