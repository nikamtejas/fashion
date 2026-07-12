import mongoose from "mongoose";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";
import { Invoice } from "../models/Invoice";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import { Product } from "../models/Product";
import { HttpError } from "./order.service";
import { env } from "../config/env";

// Fictional but structurally-valid business identity for the invoice header.
export const BUSINESS = {
  name: "LuxeLoom Retail Pvt. Ltd.",
  address: "Warehouse 7, Bhiwandi, Maharashtra — 421302",
  gstin: "27AAACL1234F1Z5",
  state: "Maharashtra",
  stateCode: "27",
  email: "billing@luxeloom.example",
  terms: "Goods once sold can be returned within the published return window. This is a computer-generated invoice.",
};

// HSN defaults per category (Indian tariff chapters for apparel/footwear).
const HSN_BY_CATEGORY: Record<string, string> = {
  men: "6203",
  women: "6204",
  accessories: "4202",
  footwear: "6403",
};
const HSN_FALLBACK = "6109";

const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Amount in words (Indian numbering: lakh / crore) ──────────────────────

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
}

function threeDigits(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  return `${hundred ? ONES[hundred] + " Hundred" + (rest ? " " : "") : ""}${rest ? twoDigits(rest) : ""}`;
}

export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  let n = rupees;
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));

  let words = parts.length ? `${parts.join(" ")} Rupees` : "";
  if (paise) words += `${words ? " and " : ""}${twoDigits(paise)} Paise`;
  return `${words} Only`;
}

// ─── Sequential numbering (Indian FY series, atomic) ────────────────────────

function fySeries(date = new Date()): string {
  const y = date.getFullYear();
  const fyStart = date.getMonth() >= 3 ? y : y - 1; // FY starts in April
  return `${String(fyStart).slice(2)}${String(fyStart + 1).slice(2)}`; // e.g. "2627"
}

async function nextInvoiceNumber(): Promise<string> {
  const series = fySeries();
  const counters = mongoose.connection.collection("counters");
  const result = await counters.findOneAndUpdate(
    { _id: `invoice-${series}` as unknown as mongoose.Types.ObjectId },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  const seq = (result?.seq as number) ?? 1;
  return `INV-${series}-${String(seq).padStart(5, "0")}`;
}

// ─── Invoice creation ───────────────────────────────────────────────────────

/** Idempotently creates the GST invoice for a confirmed order. Called from
 * every payment-success path and lazily from the download/register routes. */
export async function ensureInvoiceForOrder(orderId: string) {
  const existing = await Invoice.findOne({ order: orderId });
  if (existing) return existing;

  const order = await Order.findById(orderId).populate("user", "name email").lean();
  if (!order) throw new HttpError(404, "Order not found");
  if (order.status === "PENDING_PAYMENT") throw new HttpError(400, "Invoice is issued once payment completes");

  // Category → HSN per line item.
  const productIds = [...new Set(order.items.map((i) => String(i.product)))];
  const products = await Product.find({ _id: { $in: productIds } }).populate("category", "slug").lean();
  const bySlug = new Map(products.map((p) => [String(p._id), (p.category as unknown as { slug?: string })?.slug ?? ""]));

  // Intra-state (Maharashtra) = CGST+SGST; anything else = IGST.
  const igstApplies =
    order.deliveryMethod === "HOME" && order.shippingAddress
      ? order.shippingAddress.state.trim().toLowerCase() !== BUSINESS.state.toLowerCase()
      : false;

  const gstTotal = order.pricing.gst;
  const cgst = igstApplies ? 0 : round2(gstTotal / 2);
  const sgst = igstApplies ? 0 : round2(gstTotal - cgst);
  const igst = igstApplies ? gstTotal : 0;

  const lines = order.items.map((i) => {
    const product = products.find((p) => String(p._id) === String(i.product));
    return {
      name: i.name,
      hsnCode: HSN_BY_CATEGORY[bySlug.get(String(i.product)) ?? ""] ?? HSN_FALLBACK,
      qty: i.qty,
      price: i.price,
      gstRate: product?.pricing?.gstRate ?? 5,
    };
  });

  return Invoice.create({
    order: order._id,
    invoiceNumber: await nextInvoiceNumber(),
    lines,
    cgst,
    sgst,
    igst,
    total: order.pricing.total,
    amountInWords: amountInWords(order.pricing.total),
    isPos: order.deliveryMethod === "POS",
  });
}

// ─── PDF rendering ──────────────────────────────────────────────────────────

interface InvoiceRenderData {
  invoice: { invoiceNumber: string; lines: { name: string; hsnCode?: string | null; qty: number; price: number; gstRate: number }[]; cgst: number; sgst: number; igst: number; total: number; amountInWords?: string | null; createdAt?: Date };
  order: { orderNumber: string; _id: unknown; pricing: { subtotal: number; discount: number; gst: number; shipping: number; codFee?: number; total: number }; shippingAddress?: { name: string; line1: string; line2?: string | null; city: string; state: string; pincode: string } | null; deliveryMethod: string };
  customer: { name?: string | null; email: string };
  paymentMethod?: string;
}

async function orderQr(orderId: unknown): Promise<string> {
  return QRCode.toDataURL(`${env.frontendUrl}/account/orders/${orderId}`, { margin: 0, width: 120 });
}

/** A4 GST invoice. */
export async function renderInvoiceA4(data: InvoiceRenderData): Promise<PDFKit.PDFDocument> {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const { invoice, order, customer } = data;

  doc.fontSize(18).font("Helvetica-Bold").text(BUSINESS.name);
  doc.fontSize(8).font("Helvetica").fillColor("#444");
  doc.text(BUSINESS.address);
  doc.text(`GSTIN: ${BUSINESS.gstin} · ${BUSINESS.email}`);
  doc.fillColor("#000").moveDown(0.5);

  const qr = await orderQr(order._id);
  doc.image(Buffer.from(qr.split(",")[1], "base64"), 475, 40, { width: 80 });
  doc.fontSize(6).fillColor("#666").text("Scan for order", 475, 124, { width: 80, align: "center" });
  doc.fillColor("#000");

  doc.fontSize(13).font("Helvetica-Bold").text("TAX INVOICE", 40, 130);
  doc.fontSize(9).font("Helvetica");
  doc.text(`Invoice no: ${invoice.invoiceNumber}`);
  doc.text(`Date: ${(invoice.createdAt ?? new Date()).toLocaleDateString("en-IN")}`);
  doc.text(`Order: ${order.orderNumber}${data.paymentMethod ? ` · Paid via ${data.paymentMethod}` : ""}`);
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").text("Billed to:");
  doc.font("Helvetica");
  doc.text(customer.name ?? customer.email);
  if (order.shippingAddress) {
    const a = order.shippingAddress;
    doc.text(`${a.line1}${a.line2 ? `, ${a.line2}` : ""}, ${a.city}, ${a.state} — ${a.pincode}`);
  } else {
    doc.text(order.deliveryMethod === "POS" ? "Walk-in customer (POS)" : "Store pickup");
  }
  doc.moveDown(1);

  // Line-item table
  const tableTop = doc.y;
  const cols = [40, 250, 310, 360, 420, 490];
  doc.font("Helvetica-Bold").fontSize(8);
  ["Item", "HSN", "Qty", "Rate Rs.", "GST %", "Amount Rs."].forEach((h, i) => doc.text(h, cols[i], tableTop, { width: (cols[i + 1] ?? 555) - cols[i] - 8 }));
  doc.moveTo(40, tableTop + 12).lineTo(555, tableTop + 12).strokeColor("#999").stroke();

  let y = tableTop + 18;
  doc.font("Helvetica").fontSize(8);
  for (const line of invoice.lines) {
    doc.text(line.name, cols[0], y, { width: 200 });
    doc.text(line.hsnCode ?? "", cols[1], y);
    doc.text(String(line.qty), cols[2], y);
    doc.text(line.price.toFixed(2), cols[3], y);
    doc.text(`${line.gstRate}%`, cols[4], y);
    doc.text((line.price * line.qty).toFixed(2), cols[5], y);
    y += 16;
  }
  doc.moveTo(40, y).lineTo(555, y).strokeColor("#999").stroke();
  y += 8;

  const totals: [string, number][] = [
    ["Subtotal (incl. GST)", order.pricing.subtotal],
    ...(order.pricing.discount > 0 ? ([["Discount", -order.pricing.discount]] as [string, number][]) : []),
    ...(order.pricing.shipping > 0 ? ([["Shipping", order.pricing.shipping]] as [string, number][]) : []),
    ...((order.pricing.codFee ?? 0) > 0 ? ([["COD fee", order.pricing.codFee!]] as [string, number][]) : []),
    ...(invoice.igst > 0
      ? ([["IGST (within total)", invoice.igst]] as [string, number][])
      : ([
          ["CGST (within total)", invoice.cgst],
          ["SGST (within total)", invoice.sgst],
        ] as [string, number][])),
  ];
  doc.fontSize(9);
  for (const [label, value] of totals) {
    doc.font("Helvetica").text(label, 360, y, { width: 120, align: "right" });
    doc.text(value.toFixed(2), 490, y, { width: 65, align: "right" });
    y += 14;
  }
  doc.font("Helvetica-Bold").fontSize(11);
  doc.text("TOTAL", 360, y + 2, { width: 120, align: "right" });
  doc.text(`Rs. ${invoice.total.toFixed(2)}`, 470, y + 2, { width: 85, align: "right" });
  y += 24;

  doc.font("Helvetica-Oblique").fontSize(8).text(`Amount in words: ${invoice.amountInWords}`, 40, y, { width: 515 });
  y += 24;
  doc.font("Helvetica").fontSize(7).fillColor("#666").text(BUSINESS.terms, 40, y, { width: 515 });

  doc.end();
  return doc;
}

/** 80mm thermal receipt. */
export async function renderInvoiceThermal(data: InvoiceRenderData): Promise<PDFKit.PDFDocument> {
  const { invoice, order, customer } = data;
  const width = 227; // 80mm at 72dpi
  const doc = new PDFDocument({ size: [width, 500 + invoice.lines.length * 24], margin: 10 });

  const center = { width: width - 20, align: "center" as const };
  doc.fontSize(11).font("Helvetica-Bold").text(BUSINESS.name, center);
  doc.fontSize(6).font("Helvetica").text(BUSINESS.address, center);
  doc.text(`GSTIN ${BUSINESS.gstin}`, center);
  doc.moveDown(0.4);
  doc.fontSize(8).font("Helvetica-Bold").text("TAX INVOICE", center);
  doc.fontSize(6.5).font("Helvetica");
  doc.text(`${invoice.invoiceNumber} · ${(invoice.createdAt ?? new Date()).toLocaleString("en-IN")}`, center);
  doc.text(`Order ${order.orderNumber}`, center);
  doc.text(`Customer: ${customer.name ?? customer.email}`, center);
  doc.moveDown(0.4);
  doc.text("-".repeat(48), center);

  for (const line of invoice.lines) {
    doc.font("Helvetica").fontSize(7).text(`${line.name}  (HSN ${line.hsnCode ?? "-"})`, { width: width - 20 });
    doc.text(`${line.qty} × ${line.price.toFixed(2)}  GST ${line.gstRate}%`, 10, doc.y, { continued: true, width: width - 20 });
    doc.text((line.qty * line.price).toFixed(2), { align: "right" });
  }

  doc.text("-".repeat(48), center);
  const row = (label: string, value: string, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 9 : 7);
    doc.text(label, 10, doc.y, { continued: true, width: width - 20 });
    doc.text(value, { align: "right" });
  };
  if (order.pricing.discount > 0) row("Discount", `-${order.pricing.discount.toFixed(2)}`);
  if (invoice.igst > 0) row("IGST (incl.)", invoice.igst.toFixed(2));
  else {
    row("CGST (incl.)", invoice.cgst.toFixed(2));
    row("SGST (incl.)", invoice.sgst.toFixed(2));
  }
  row("TOTAL", `Rs. ${invoice.total.toFixed(2)}`, true);

  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(6).text(invoice.amountInWords ?? "", center);
  doc.moveDown(0.4);

  const qr = await orderQr(order._id);
  doc.image(Buffer.from(qr.split(",")[1], "base64"), width / 2 - 30, doc.y, { width: 60 });
  doc.y += 66;
  doc.fontSize(6).text("Thank you for shopping with LuxeLoom", center);

  doc.end();
  return doc;
}

/** Collects a finished pdfkit stream into a Buffer (for email attachments).
 * Safe to call after doc.end() — readable streams buffer until read. */
export function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

/** A4 order confirmation — the "your order is in" document attached to the
 * confirmation email. Not a tax document; the GST invoice follows the
 * same order and is attached on delivery. */
export async function renderOrderConfirmationA4(opts: {
  order: {
    _id: unknown;
    orderNumber: string;
    createdAt?: Date;
    items: { name: string; size?: string | null; color?: string | null; qty: number; price: number }[];
    pricing: { subtotal: number; discount: number; gst: number; shipping: number; codFee?: number; total: number };
    shippingAddress?: { name: string; line1: string; line2?: string | null; city: string; state: string; pincode: string } | null;
    deliveryMethod: string;
  };
  customer: { name?: string | null; email: string };
  pickup?: { storeName?: string; date?: string; timeSlot?: string } | null;
}): Promise<PDFKit.PDFDocument> {
  const { order, customer, pickup } = opts;
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  doc.fontSize(18).font("Helvetica-Bold").text(BUSINESS.name);
  doc.fontSize(8).font("Helvetica").fillColor("#444");
  doc.text(BUSINESS.address);
  doc.text(BUSINESS.email);
  doc.fillColor("#000").moveDown(0.5);

  const qr = await orderQr(order._id);
  doc.image(Buffer.from(qr.split(",")[1], "base64"), 475, 40, { width: 80 });
  doc.fontSize(6).fillColor("#666").text("Scan for order", 475, 124, { width: 80, align: "center" });
  doc.fillColor("#000");

  doc.fontSize(13).font("Helvetica-Bold").text("ORDER CONFIRMATION", 40, 130);
  doc.fontSize(9).font("Helvetica");
  doc.text(`Order: ${order.orderNumber}`);
  doc.text(`Placed on: ${(order.createdAt ?? new Date()).toLocaleDateString("en-IN")}`);
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").text(pickup ? "Pickup details:" : "Deliver to:");
  doc.font("Helvetica");
  doc.text(customer.name ?? customer.email);
  if (pickup) {
    doc.text(`${pickup.storeName ?? "LuxeLoom store"} — ${pickup.date ?? ""}${pickup.timeSlot ? `, ${pickup.timeSlot}` : ""}`);
    doc.text("Bring a photo ID; your pickup QR code is on your order page.");
  } else if (order.shippingAddress) {
    const a = order.shippingAddress;
    doc.text(`${a.line1}${a.line2 ? `, ${a.line2}` : ""}, ${a.city}, ${a.state} — ${a.pincode}`);
  }
  doc.moveDown(1);

  const tableTop = doc.y;
  const cols = [40, 330, 380, 460];
  doc.font("Helvetica-Bold").fontSize(8);
  ["Item", "Qty", "Rate Rs.", "Amount Rs."].forEach((h, i) =>
    doc.text(h, cols[i], tableTop, { width: (cols[i + 1] ?? 555) - cols[i] - 8 })
  );
  doc.moveTo(40, tableTop + 12).lineTo(555, tableTop + 12).strokeColor("#999").stroke();

  let y = tableTop + 18;
  doc.font("Helvetica").fontSize(8);
  for (const item of order.items) {
    const variant = [item.size, item.color].filter(Boolean).join(" / ");
    doc.text(`${item.name}${variant ? ` (${variant})` : ""}`, cols[0], y, { width: 280 });
    doc.text(String(item.qty), cols[1], y);
    doc.text(item.price.toFixed(2), cols[2], y);
    doc.text((item.price * item.qty).toFixed(2), cols[3], y);
    y += 16;
  }
  doc.moveTo(40, y).lineTo(555, y).strokeColor("#999").stroke();
  y += 8;

  const totals: [string, number][] = [
    ["Subtotal (incl. GST)", order.pricing.subtotal],
    ...(order.pricing.discount > 0 ? ([["Discount", -order.pricing.discount]] as [string, number][]) : []),
    ...(order.pricing.shipping > 0 ? ([["Shipping", order.pricing.shipping]] as [string, number][]) : []),
    ...((order.pricing.codFee ?? 0) > 0 ? ([["COD fee", order.pricing.codFee!]] as [string, number][]) : []),
  ];
  doc.fontSize(9);
  for (const [label, value] of totals) {
    doc.font("Helvetica").text(label, 360, y, { width: 120, align: "right" });
    doc.text(value.toFixed(2), 490, y, { width: 65, align: "right" });
    y += 14;
  }
  doc.font("Helvetica-Bold").fontSize(11);
  doc.text("TOTAL", 360, y + 2, { width: 120, align: "right" });
  doc.text(`Rs. ${order.pricing.total.toFixed(2)}`, 470, y + 2, { width: 85, align: "right" });
  y += 28;

  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor("#666")
    .text(
      "This document confirms your order. Your GST tax invoice is attached to the delivery email and is always available from your order page.",
      40,
      y,
      { width: 515 }
    );

  doc.end();
  return doc;
}

/** Loads everything a renderer needs. */
export async function loadInvoiceRenderData(orderId: string): Promise<InvoiceRenderData> {
  const invoice = await ensureInvoiceForOrder(orderId);
  const order = await Order.findById(orderId).populate("user", "name email").lean();
  if (!order) throw new HttpError(404, "Order not found");
  const payment = await Payment.findOne({ order: order._id }).select("method").lean();
  const user = order.user as unknown as { name?: string | null; email: string };
  return {
    invoice: invoice.toObject ? invoice.toObject() : invoice,
    order,
    customer: { name: user?.name, email: user?.email ?? "" },
    paymentMethod: payment?.method,
  };
}
