import { sendOrderConfirmationEmail } from "./order.service";
import { ensureInvoiceForOrder } from "./invoice.service";
import { awardPointsForOrder } from "./loyalty.service";
import { sendNewOrderAdminEmail } from "./orderEmails.service";

/** Everything that happens exactly once when an order becomes real:
 * confirmation email, admin alert, GST invoice, loyalty points. None of the
 * four depend on each other, so they run in parallel; each is independently
 * fault-tolerant so one failure never blocks (or is blocked by) the rest. */
export async function onOrderConfirmed(orderId: string) {
  await Promise.allSettled([
    sendOrderConfirmationEmail(orderId).catch((e) => console.error("confirmation email failed:", e)),
    sendNewOrderAdminEmail(orderId).catch((e) => console.error("admin order email failed:", e)),
    ensureInvoiceForOrder(orderId).catch((e) => console.error("invoice generation failed:", e)),
    awardPointsForOrder(orderId).catch((e) => console.error("loyalty award failed:", e)),
  ]);
}
