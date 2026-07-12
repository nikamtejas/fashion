import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireAuth } from "../middleware/auth";
import { placeOrder, sendOrderConfirmationEmail, HttpError, type AddressInput } from "../services/order.service";
import { buildCartView } from "../services/cart.service";
import { getSettings } from "../models/Settings";
import { User } from "../models/User";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import { OtpToken } from "../models/OtpToken";
import { sendOtpEmail } from "../lib/mailer";
import { checkServiceability } from "../lib/integrations/bluedart";
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  mockSignPayment,
} from "../lib/integrations/razorpay";
import { computeEmiPlans, createSnapmintOrder, EMI_TENURES, type EmiTenure } from "../lib/integrations/snapmint";
import { INTEGRATIONS_MOCK } from "../lib/integrations";
import crypto from "node:crypto";

const router = Router();

/** EMI quotes for any amount — public so product pages can show the widget. */
router.get("/emi-plans", async (req, res) => {
  const amount = Number(req.query.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: "Provide an amount" });

  const settings = await getSettings();
  if (amount < settings.emiMinimumOrderValue) {
    return res.json({ eligible: false, threshold: settings.emiMinimumOrderValue, plans: [] });
  }
  res.json({ eligible: true, threshold: settings.emiMinimumOrderValue, plans: computeEmiPlans(amount) });
});

router.use(requireAuth);

/** Checkout-relevant settings, readable by any signed-in customer. */
router.get("/checkout-settings", async (_req, res) => {
  const settings = await getSettings();
  res.json({
    codConvenienceFee: settings.codConvenienceFee,
    codMaxOrderValue: settings.codMaxOrderValue,
    emiMinimumOrderValue: settings.emiMinimumOrderValue,
  });
});

// ─── Shared checkout payload ────────────────────────────────────────────────

const addressSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  line1: z.string().min(3),
  line2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/),
});

const checkoutSchema = z
  .object({
    deliveryMethod: z.enum(["HOME", "PICKUP"]),
    addressId: z.string().optional(),
    address: addressSchema.optional(),
    storeId: z.string().optional(),
    appointment: z
      .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), timeSlot: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/) })
      .optional(),
  })
  .refine((d) => d.deliveryMethod === "PICKUP" || d.addressId || d.address, { message: "Provide a delivery address" })
  .refine((d) => d.deliveryMethod === "HOME" || (d.storeId && d.appointment), {
    message: "Pick a store and appointment slot",
  });

type CheckoutPayload = z.infer<typeof checkoutSchema>;

async function resolveAddress(userId: string, payload: CheckoutPayload): Promise<AddressInput | undefined> {
  if (payload.deliveryMethod !== "HOME") return undefined;
  if (payload.address) return payload.address;
  const user = await User.findById(userId).select("addresses").lean();
  const saved = user?.addresses.find((a) => String(a._id) === payload.addressId);
  if (!saved) throw new HttpError(404, "Saved address not found");
  return {
    name: saved.name,
    phone: saved.phone,
    line1: saved.line1,
    line2: saved.line2 ?? undefined,
    city: saved.city,
    state: saved.state,
    pincode: saved.pincode,
  };
}

/** Loads an order for the caller, ensuring ownership. */
async function loadOwnOrder(orderId: string, userId: string) {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) throw new HttpError(404, "Order not found");
  return order;
}

// ─── Razorpay ───────────────────────────────────────────────────────────────

router.post("/razorpay/initiate", async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });

  try {
    const address = await resolveAddress(req.user!.uid, parsed.data);
    const order = await placeOrder({
      userId: req.user!.uid,
      deliveryMethod: parsed.data.deliveryMethod,
      address,
      storeId: parsed.data.storeId,
      appointment: parsed.data.appointment,
      paymentMethod: "RAZORPAY",
      initialStatus: "PENDING_PAYMENT",
    });
    if (!order) throw new HttpError(500, "Order creation failed");

    const rzpOrder = await createRazorpayOrder(order.pricing.total, order.orderNumber);
    await Payment.updateOne({ order: order._id }, { razorpayOrderId: rzpOrder.id });

    res.status(201).json({
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      razorpay: { orderId: rzpOrder.id, keyId: rzpOrder.keyId, amount: rzpOrder.amount, currency: rzpOrder.currency },
      mock: INTEGRATIONS_MOCK,
    });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

/** MOCK-only: mints a payment id + valid signature so the dev checkout can
 * exercise the real verification path without Razorpay's hosted UI. */
router.post("/razorpay/mock-pay/:orderId", async (req, res) => {
  if (!INTEGRATIONS_MOCK) return res.status(404).json({ error: "Not available in live mode" });
  try {
    const order = await loadOwnOrder(req.params.orderId, req.user!.uid);
    const payment = await Payment.findOne({ order: order._id });
    if (!payment?.razorpayOrderId) return res.status(400).json({ error: "No Razorpay order to pay" });

    const paymentId = `pay_MOCK${crypto.randomBytes(6).toString("hex")}`;
    res.json({
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: mockSignPayment(payment.razorpayOrderId, paymentId),
    });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

const verifySchema = z.object({
  orderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

router.post("/razorpay/verify", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid verification payload" });

  try {
    const order = await loadOwnOrder(parsed.data.orderId, req.user!.uid);
    const payment = await Payment.findOne({ order: order._id });
    if (!payment?.razorpayOrderId) return res.status(400).json({ error: "No payment pending on this order" });
    if (payment.status === "PAID") return res.json({ ok: true, order });

    const valid = verifyPaymentSignature(payment.razorpayOrderId, parsed.data.razorpayPaymentId, parsed.data.razorpaySignature);
    if (!valid) {
      return res.status(400).json({ error: "Payment signature verification failed" });
    }

    payment.status = "PAID";
    payment.razorpayPaymentId = parsed.data.razorpayPaymentId;
    payment.razorpaySignature = parsed.data.razorpaySignature;
    await payment.save();

    order.status = "PLACED";
    await order.save();
    await sendOrderConfirmationEmail(String(order._id));

    res.json({ ok: true, order });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

router.post("/razorpay/fail", async (req, res) => {
  const orderId = String(req.body?.orderId ?? "");
  try {
    const order = await loadOwnOrder(orderId, req.user!.uid);
    // Order stays PENDING_PAYMENT so the retry screen can re-attempt; the
    // 15-minute cleanup releases the reservation if the customer walks away.
    await Payment.updateOne({ order: order._id, status: "PENDING" }, { status: "FAILED" });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

// ─── Cash on Delivery ───────────────────────────────────────────────────────

router.post("/cod/request-otp", async (req, res) => {
  const user = await User.findById(req.user!.uid).select("email").lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await bcrypt.hash(code, 10);
  // Namespaced so a COD confirmation code can never be replayed as a login code.
  await OtpToken.create({ email: `cod:${user.email}`, codeHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
  await sendOtpEmail(user.email, code);

  res.json({ ok: true });
});

const codPlaceSchema = checkoutSchema.safeExtend({ otp: z.string().min(4) });

router.post("/cod/place", async (req, res) => {
  const parsed = codPlaceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });

  try {
    const user = await User.findById(req.user!.uid).select("email").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    // 1. OTP check.
    const token = await OtpToken.findOne({ email: `cod:${user.email}`, consumedAt: { $exists: false } }).sort({ createdAt: -1 });
    if (!token || token.expiresAt < new Date() || !(await bcrypt.compare(parsed.data.otp.trim(), token.codeHash))) {
      return res.status(401).json({ error: "Incorrect or expired confirmation code" });
    }

    const settings = await getSettings();
    const view = await buildCartView(req.user!.uid);

    // 2. Eligibility: order value cap + serviceable pincode for home delivery.
    if (view.totals.total > settings.codMaxOrderValue) {
      return res.status(400).json({
        error: `Cash on Delivery is available only for orders up to ₹${settings.codMaxOrderValue.toLocaleString("en-IN")}`,
      });
    }
    const address = await resolveAddress(req.user!.uid, parsed.data);
    if (parsed.data.deliveryMethod === "HOME" && address) {
      const svc = await checkServiceability(address.pincode);
      if (!svc.serviceable) {
        return res.status(400).json({ error: "Cash on Delivery isn't available for this pincode" });
      }
    }

    token.consumedAt = new Date();
    await token.save();

    const order = await placeOrder({
      userId: req.user!.uid,
      deliveryMethod: parsed.data.deliveryMethod,
      address,
      storeId: parsed.data.storeId,
      appointment: parsed.data.appointment,
      paymentMethod: "COD",
      codFee: settings.codConvenienceFee,
      initialStatus: "PLACED",
    });

    res.status(201).json({ order });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

// ─── Snapmint EMI ───────────────────────────────────────────────────────────

const snapmintInitiateSchema = checkoutSchema.safeExtend({
  tenure: z.union([z.literal(3), z.literal(6), z.literal(9), z.literal(12)]),
});

router.post("/snapmint/initiate", async (req, res) => {
  const parsed = snapmintInitiateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });

  try {
    const settings = await getSettings();
    const view = await buildCartView(req.user!.uid);
    if (view.totals.total < settings.emiMinimumOrderValue) {
      return res.status(400).json({
        error: `EMI is available on orders of ₹${settings.emiMinimumOrderValue.toLocaleString("en-IN")} or more`,
      });
    }

    const address = await resolveAddress(req.user!.uid, parsed.data);
    const order = await placeOrder({
      userId: req.user!.uid,
      deliveryMethod: parsed.data.deliveryMethod,
      address,
      storeId: parsed.data.storeId,
      appointment: parsed.data.appointment,
      paymentMethod: "SNAPMINT",
      initialStatus: "PENDING_PAYMENT",
    });
    if (!order) throw new HttpError(500, "Order creation failed");

    const plan = computeEmiPlans(order.pricing.total).find((p) => p.tenureMonths === parsed.data.tenure)!;
    const snapmint = await createSnapmintOrder(order.pricing.total, parsed.data.tenure as EmiTenure, order.orderNumber);

    await Payment.updateOne(
      { order: order._id },
      {
        snapmintPlan: {
          tenureMonths: plan.tenureMonths,
          monthlyAmount: plan.monthlyAmount,
          downPayment: plan.downPayment,
          snapmintOrderId: snapmint.snapmintOrderId,
        },
      }
    );

    res.status(201).json({
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      approvalUrl: snapmint.approvalUrl,
      plan,
      mock: INTEGRATIONS_MOCK,
    });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

const snapmintCallbackSchema = z.object({ orderId: z.string(), status: z.enum(["success", "failure"]) });

router.post("/snapmint/callback", async (req, res) => {
  const parsed = snapmintCallbackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid callback" });

  try {
    const order = await loadOwnOrder(parsed.data.orderId, req.user!.uid);
    const payment = await Payment.findOne({ order: order._id });
    if (!payment || payment.method !== "SNAPMINT") return res.status(400).json({ error: "No EMI payment on this order" });
    if (payment.status === "PAID") return res.json({ ok: true, order });

    if (parsed.data.status === "success") {
      payment.status = "PAID";
      await payment.save();
      order.status = "PLACED";
      await order.save();
      await sendOrderConfirmationEmail(String(order._id));
    } else {
      payment.status = "FAILED";
      await payment.save();
    }

    res.json({ ok: parsed.data.status === "success", order });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

// ─── Retry screen support ───────────────────────────────────────────────────

router.get("/order/:orderId", async (req, res) => {
  try {
    const order = await loadOwnOrder(req.params.orderId, req.user!.uid);
    const payment = await Payment.findOne({ order: order._id }).lean();
    const settings = await getSettings();
    res.json({
      order: {
        id: String(order._id),
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.pricing.total,
      },
      payment: payment
        ? { method: payment.method, status: payment.status, snapmintPlan: payment.snapmintPlan ?? null }
        : null,
      emiEligible: order.pricing.total >= settings.emiMinimumOrderValue,
      canRetry: order.status === "PENDING_PAYMENT",
    });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

const retrySchema = z.object({
  method: z.enum(["RAZORPAY", "SNAPMINT"]),
  tenure: z.union([z.literal(3), z.literal(6), z.literal(9), z.literal(12)]).optional(),
});

/** Re-initiates payment on an existing PENDING_PAYMENT order — allows both
 * retrying the same method and switching between Razorpay and EMI. */
router.post("/retry/:orderId", async (req, res) => {
  const parsed = retrySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid retry request" });

  try {
    const order = await loadOwnOrder(req.params.orderId, req.user!.uid);
    if (order.status !== "PENDING_PAYMENT") {
      return res.status(400).json({ error: "This order is no longer awaiting payment" });
    }
    const payment = await Payment.findOne({ order: order._id });
    if (!payment) return res.status(400).json({ error: "No payment record on this order" });

    if (parsed.data.method === "RAZORPAY") {
      const rzpOrder = await createRazorpayOrder(order.pricing.total, order.orderNumber);
      payment.method = "RAZORPAY";
      payment.status = "PENDING";
      payment.razorpayOrderId = rzpOrder.id;
      payment.snapmintPlan = undefined;
      await payment.save();
      return res.json({
        orderId: String(order._id),
        razorpay: { orderId: rzpOrder.id, keyId: rzpOrder.keyId, amount: rzpOrder.amount, currency: rzpOrder.currency },
        mock: INTEGRATIONS_MOCK,
      });
    }

    const settings = await getSettings();
    if (order.pricing.total < settings.emiMinimumOrderValue) {
      return res.status(400).json({ error: "This order doesn't meet the EMI minimum" });
    }
    const tenure = (parsed.data.tenure ?? 3) as EmiTenure;
    if (!EMI_TENURES.includes(tenure)) return res.status(400).json({ error: "Pick a valid tenure" });
    const plan = computeEmiPlans(order.pricing.total).find((p) => p.tenureMonths === tenure)!;
    const snapmint = await createSnapmintOrder(order.pricing.total, tenure, order.orderNumber);
    payment.method = "SNAPMINT";
    payment.status = "PENDING";
    payment.razorpayOrderId = undefined;
    payment.snapmintPlan = {
      tenureMonths: plan.tenureMonths,
      monthlyAmount: plan.monthlyAmount,
      downPayment: plan.downPayment,
      snapmintOrderId: snapmint.snapmintOrderId,
    } as typeof payment.snapmintPlan;
    await payment.save();

    res.json({ orderId: String(order._id), approvalUrl: snapmint.approvalUrl, plan, mock: INTEGRATIONS_MOCK });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

export default router;
