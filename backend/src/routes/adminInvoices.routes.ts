import { Router } from "express";
import { requireAdmin } from "../middleware/auth";
import { Invoice } from "../models/Invoice";
import { Order } from "../models/Order";
import {
  ensureInvoiceForOrder,
  loadInvoiceRenderData,
  renderInvoiceA4,
  renderInvoiceThermal,
} from "../services/invoice.service";
import { HttpError } from "../services/order.service";

const router = Router();
router.use(requireAdmin);

function monthRange(month?: string): { from: Date; to: Date } | null {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;
  const from = new Date(`${month}-01T00:00:00`);
  const to = new Date(from);
  to.setMonth(to.getMonth() + 1);
  return { from, to };
}

/** Invoice register. Backfills invoices for any confirmed orders that
 * predate the invoicing engine before listing. */
router.get("/", async (req, res) => {
  const range = monthRange(req.query.month as string | undefined);

  const orderQuery: Record<string, unknown> = { status: { $nin: ["PENDING_PAYMENT", "CANCELLED"] } };
  if (range) orderQuery.createdAt = { $gte: range.from, $lt: range.to };
  const orders = await Order.find(orderQuery).select("_id").lean();
  for (const o of orders) {
    await ensureInvoiceForOrder(String(o._id)).catch(() => {});
  }

  const invQuery: Record<string, unknown> = {};
  if (range) invQuery.createdAt = { $gte: range.from, $lt: range.to };
  const invoices = await Invoice.find(invQuery)
    .sort({ invoiceNumber: 1 })
    .populate({ path: "order", select: "orderNumber deliveryMethod pricing.total user", populate: { path: "user", select: "email" } })
    .lean();

  res.json({ invoices });
});

router.get("/:id/pdf", async (req, res) => {
  const invoice = await Invoice.findById(req.params.id).lean();
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  try {
    const data = await loadInvoiceRenderData(String(invoice.order));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${invoice.invoiceNumber}.pdf"`);
    const doc = req.query.format === "thermal" ? await renderInvoiceThermal(data) : await renderInvoiceA4(data);
    doc.pipe(res);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

/** Bulk ZIP of a month's invoice PDFs, for filing. */
router.get("/export.zip", async (req, res) => {
  const range = monthRange(req.query.month as string | undefined);
  const query: Record<string, unknown> = {};
  if (range) query.createdAt = { $gte: range.from, $lt: range.to };
  const invoices = await Invoice.find(query).sort({ invoiceNumber: 1 }).lean();

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="invoices-${(req.query.month as string) ?? "all"}.zip"`);

  // archiver v8 ships ESM-only with a class-based API (new ZipArchive()) —
  // loaded dynamically from this CJS backend; @types/archiver still
  // describes the old v5 callable shape, so the narrow surface used here
  // is typed structurally instead (verified against the installed source).
  interface ZipArchiveInstance {
    pipe(dest: NodeJS.WritableStream): void;
    append(source: Buffer, opts: { name: string }): void;
    finalize(): Promise<void>;
  }
  const archiverModule = (await import("archiver")) as unknown as {
    ZipArchive: new (options?: Record<string, unknown>) => ZipArchiveInstance;
  };
  const archive = new archiverModule.ZipArchive();
  archive.pipe(res);

  for (const invoice of invoices) {
    try {
      const data = await loadInvoiceRenderData(String(invoice.order));
      const doc = await renderInvoiceA4(data);
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        doc.on("data", (c: Buffer) => chunks.push(c));
        doc.on("end", () => resolve());
        doc.on("error", reject);
      });
      archive.append(Buffer.concat(chunks), { name: `${invoice.invoiceNumber}.pdf` });
    } catch {
      // skip broken entries rather than failing the whole export
    }
  }

  await archive.finalize();
});

/** Monthly GST output-tax summary for filing: taxable value + tax split by rate. */
router.get("/gst-summary", async (req, res) => {
  const month = (req.query.month as string | undefined) ?? new Date().toISOString().slice(0, 7);
  const range = monthRange(month);
  if (!range) return res.status(400).json({ error: "Pass month=YYYY-MM" });

  const invoices = await Invoice.find({ createdAt: { $gte: range.from, $lt: range.to } }).lean();

  const byRate = new Map<number, { taxableValue: number; cgst: number; sgst: number; igst: number }>();
  let totals = { invoiceCount: 0, grossTotal: 0, cgst: 0, sgst: 0, igst: 0 };

  for (const inv of invoices) {
    totals.invoiceCount += 1;
    totals.grossTotal += inv.total;
    totals.cgst += inv.cgst;
    totals.sgst += inv.sgst;
    totals.igst += inv.igst;

    // Allocate the invoice's tax across its line rates proportionally to
    // line value, so the per-rate summary sums exactly to the totals.
    const lineSum = inv.lines.reduce((s, l) => s + l.price * l.qty, 0) || 1;
    for (const line of inv.lines) {
      const share = (line.price * line.qty) / lineSum;
      const entry = byRate.get(line.gstRate) ?? { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 };
      const gross = line.price * line.qty;
      entry.taxableValue += gross / (1 + line.gstRate / 100);
      entry.cgst += inv.cgst * share;
      entry.sgst += inv.sgst * share;
      entry.igst += inv.igst * share;
      byRate.set(line.gstRate, entry);
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  res.json({
    month,
    totals: {
      invoiceCount: totals.invoiceCount,
      grossTotal: round2(totals.grossTotal),
      cgst: round2(totals.cgst),
      sgst: round2(totals.sgst),
      igst: round2(totals.igst),
    },
    byRate: [...byRate.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rate, v]) => ({
        rate,
        taxableValue: round2(v.taxableValue),
        cgst: round2(v.cgst),
        sgst: round2(v.sgst),
        igst: round2(v.igst),
      })),
  });
});

export default router;
