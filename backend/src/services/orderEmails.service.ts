import { Order } from "../models/Order";
import { User } from "../models/User";
import { Payment } from "../models/Payment";
import { Notification } from "../models/Notification";
import { getSettings } from "../models/Settings";
import { sendEmail } from "../lib/mailer";
import { env } from "../config/env";
import { notifyAdmins } from "./notify.service";
import { loadInvoiceRenderData, renderInvoiceA4, pdfToBuffer } from "./invoice.service";
import { orderSubject, summarizeItems } from "../lib/orderSubject";

/** Heads-up to every admin when an order becomes real. */
export async function sendNewOrderAdminEmail(orderId: string) {
  const order = await Order.findById(orderId).select("orderNumber items pricing deliveryMethod user").lean();
  if (!order) return;
  const customer = await User.findById(order.user).select("email name").lean();
  const payment = await Payment.findOne({ order: order._id }).select("method").lean();
  const itemCount = order.items.reduce((s, i) => s + i.qty, 0);

  await notifyAdmins(
    `New order: ${summarizeItems(order.items)} — ₹${order.pricing.total.toLocaleString("en-IN")} (${order.orderNumber})`,
    [
      `A new order just came in.`,
      ``,
      `Order: ${order.orderNumber}`,
      `Total: ₹${order.pricing.total.toLocaleString("en-IN")} · ${itemCount} item${itemCount === 1 ? "" : "s"}`,
      `Payment: ${payment?.method ?? "—"} · Delivery: ${order.deliveryMethod}`,
      `Customer: ${[customer?.name, customer?.email].filter(Boolean).join(" · ") || "—"}`,
      ``,
      `Manage: ${env.frontendUrl}/admin/orders/${order._id}`,
    ].join("\n"),
    { heading: "New order" }
  );
}

/** Delivered notification: in-app entry plus one rich email with the GST
 * invoice PDF attached (used instead of the generic notifyUser so the
 * customer gets a single, complete delivery email). */
export async function sendDeliveredEmail(orderId: string) {
  const order = await Order.findById(orderId).select("orderNumber items user").lean();
  if (!order) return;
  const user = await User.findById(order.user).select("email name").lean();
  if (!user) return;

  await Notification.create({
    user: order.user,
    title: orderSubject("Delivered", order.orderNumber, order.items),
    body: "Your GST invoice was emailed to you — it's also on your order page.",
    link: `/account/orders/${order._id}`,
  });

  // The email must still go out if the PDF pipeline hiccups.
  let attachments: { filename: string; content: Buffer }[] | undefined;
  try {
    const data = await loadInvoiceRenderData(orderId);
    const pdf = await pdfToBuffer(await renderInvoiceA4(data));
    attachments = [{ filename: `LuxeLoom-${data.invoice.invoiceNumber}.pdf`, content: pdf }];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("delivered email: invoice PDF failed:", err);
  }

  const settings = await getSettings();
  await sendEmail(
    user.email,
    orderSubject("Delivered", order.orderNumber, order.items),
    [
      `Your order has arrived — we hope you love every piece.`,
      ``,
      `Your GST invoice is attached for your records (it also lives on your order page, anytime you need it).`,
      ``,
      `If anything isn't quite right, easy returns within ${settings.returnWindowDays} days: ${env.frontendUrl}/account/orders`,
      ``,
      `Loved it? A quick review helps other shoppers find their fit — and means the world to us.`,
    ].join("\n"),
    { heading: "Enjoy your pieces", attachments }
  );
}
