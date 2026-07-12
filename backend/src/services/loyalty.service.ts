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

/** Awards points on a confirmed order — idempotent per order. */
export async function awardPointsForOrder(orderId: string) {
  const order = await Order.findById(orderId).select("user pricing.total deliveryMethod").lean();
  if (!order || order.deliveryMethod === "POS") return; // walk-ins have no account

  const earned = Math.floor(order.pricing.total / EARN_RATE_RUPEES_PER_POINT);
  if (earned <= 0) return;

  const account = await getLoyaltyAccount(String(order.user));
  const alreadyEarned = account.history.some((h) => h.type === "EARN" && String(h.order) === String(orderId));
  if (alreadyEarned) return;

  account.points += earned;
  account.history.push({ type: "EARN", points: earned, order: order._id, date: new Date() } as (typeof account.history)[number]);
  await account.save();
}
