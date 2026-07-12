import { sendOrderConfirmationEmail } from "./order.service";
import { ensureInvoiceForOrder } from "./invoice.service";
import { awardPointsForOrder } from "./loyalty.service";
import { sendNewOrderAdminEmail } from "./orderEmails.service";

/** Everything that happens exactly once when an order becomes real:
 * confirmation email, admin alert, GST invoice, loyalty points. Each step
 * is independently fault-tolerant so one failure never blocks the others. */
export async function onOrderConfirmed(orderId: string) {
  await sendOrderConfirmationEmail(orderId).catch((e) => console.error("confirmation email failed:", e));
  await sendNewOrderAdminEmail(orderId).catch((e) => console.error("admin order email failed:", e));
  await ensureInvoiceForOrder(orderId).catch((e) => console.error("invoice generation failed:", e));
  await awardPointsForOrder(orderId).catch((e) => console.error("loyalty award failed:", e));
}
