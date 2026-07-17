import type { ClientSession } from "mongoose";
import { LoyaltyAccount } from "../models/LoyaltyAccount";
import { Order } from "../models/Order";
import { HttpError } from "./order.service";

/** ₹100 spent = 1 point; 1 point = ₹1 at checkout. */
export const EARN_RATE_RUPEES_PER_POINT = 100;

export async function getLoyaltyAccount(userId: string) {
  let account = await LoyaltyAccount.findOne({ user: userId });
  if (!account) account = await LoyaltyAccount.create({ user: userId, points: 0, history: [] });
  return account;
}

/** Atomically spends points inside the order transaction. */
export async function redeemPoints(userId: string, points: number, orderId: unknown, session: ClientSession) {
  const result = await LoyaltyAccount.updateOne(
    { user: userId, points: { $gte: points } },
    { $inc: { points: -points }, $push: { history: { type: "REDEEM", points, order: orderId, date: new Date() } } },
    { session }
  );
  if (result.modifiedCount === 0) {
    throw new HttpError(400, "Not enough loyalty points");
  }
}

/** Awards points on a confirmed order — idempotent per order.
 *
 * onOrderConfirmed() can genuinely fire twice for the same order (Razorpay's
 * webhook and the browser's own /razorpay/verify callback can both flip a
 * payment to PAID within milliseconds of each other), so the old
 * read-history-then-save() here was a real double-award race: two
 * concurrent calls could both read "not yet earned" before either had
 * saved. The filter below folds the duplicate check into the same atomic
 * write as the increment — only one concurrent call can match a history
 * array that doesn't yet contain this order's EARN entry. */
export async function awardPointsForOrder(orderId: string) {
  const order = await Order.findById(orderId).select("user pricing.total deliveryMethod").lean();
  if (!order || order.deliveryMethod === "POS") return; // walk-ins have no account

  const earned = Math.floor(order.pricing.total / EARN_RATE_RUPEES_PER_POINT);
  if (earned <= 0) return;

  await getLoyaltyAccount(String(order.user)); // ensures the account exists; doesn't touch balance/history

  await LoyaltyAccount.updateOne(
    { user: order.user, history: { $not: { $elemMatch: { type: "EARN", order: order._id } } } },
    { $inc: { points: earned }, $push: { history: { type: "EARN", points: earned, order: order._id, date: new Date() } } }
  );
}
