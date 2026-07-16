import { Router } from "express";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import { ensureInvoiceForOrder } from "../services/invoice.service";
import { cloudinaryUrl } from "../lib/cloudinary";

const router = Router();
router.use(requireAdmin);

const round2 = (n: number) => Math.round(n * 100) / 100;

const saleSchema = z.object({
  items: z.array(z.object({ productId: z.string(), sku: z.string(), qty: z.number().int().min(1) })).min(1),
  /** Flat rupee discount applied at the counter. */
  discount: z.number().min(0).default(0),
  paymentMode: z.enum(["CASH", "CARD", "UPI"]),
  customerNote: z.string().optional(),
});

/**
 * Walk-in POS sale: stock decrements atomically, the order lands directly
 * as DELIVERED with a PAID payment, and a POS invoice is issued — so the
 * sale flows into dashboard revenue like any online order.
 */
router.post("/sale", async (req, res) => {
  const parsed = saleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid sale" });

  const session = await mongoose.startSession();
  try {
    let orderId: string | undefined;
    await session.withTransaction(async () => {
      let subtotal = 0;
      let gst = 0;
      const items = [];

      for (const line of parsed.data.items) {
        const product = await Product.findOne({ _id: line.productId, status: "PUBLISHED" }).session(session);
        const variant = product?.variants.find((v) => v.sku === line.sku);
        if (!product || !variant) throw new PosError(`Product/SKU not found: ${line.sku}`);

        const result = await Product.updateOne(
          { _id: product._id, variants: { $elemMatch: { sku: line.sku, stock: { $gte: line.qty } } } },
          { $inc: { "variants.$.stock": -line.qty } },
          { session }
        );
        if (result.modifiedCount === 0) throw new PosError(`Only ${variant.stock} of ${product.name} (${variant.size}) in stock`);

        const price = product.pricing?.finalPrice ?? 0;
        subtotal = round2(subtotal + price * line.qty);
        gst = round2(gst + (product.pricing?.gstAmount ?? 0) * line.qty);
        items.push({
          product: product._id,
          sku: line.sku,
          name: product.name,
          image: product.images?.[0]?.publicId ? cloudinaryUrl(product.images[0].publicId, 300) : undefined,
          size: variant.size,
          color: variant.color,
          price,
          qty: line.qty,
        });
      }

      const discount = Math.min(parsed.data.discount, subtotal);
      const total = round2(subtotal - discount);

      const [order] = await Order.create(
        [
          {
            orderNumber: `LL-POS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
            user: req.user!.uid, // POS sales are booked under the staff account
            items,
            pricing: { subtotal, discount, gst, shipping: 0, codFee: 0, loyaltyRedeemed: 0, total },
            deliveryMethod: "POS",
            status: "DELIVERED",
            notes: `POS walk-in sale${parsed.data.customerNote ? ` — ${parsed.data.customerNote}` : ""}`,
          },
        ],
        { session }
      );
      orderId = String(order._id);

      const [payment] = await Payment.create(
        [{ order: order._id, method: parsed.data.paymentMode, status: "PAID", amount: total }],
        { session }
      );
      order.payment = payment._id;
      await order.save({ session });
    });

    const invoice = await ensureInvoiceForOrder(orderId!);
    const order = await Order.findById(orderId).lean();
    res.status(201).json({ order, invoice });
  } catch (err) {
    if (err instanceof PosError) return res.status(400).json({ error: err.message });
    throw err;
  } finally {
    await session.endSession();
  }
});

class PosError extends Error {}

/** Product/SKU lookup for the POS picker. */
router.get("/products", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim() ?? "";
  const query: Record<string, unknown> = { status: "PUBLISHED" };
  if (q) query.name = { $regex: q, $options: "i" };

  const products = await Product.find(query)
    .limit(10)
    .select("name slug images pricing.finalPrice variants")
    .lean();

  res.json({
    products: products.map((p) => ({
      id: String(p._id),
      name: p.name,
      image: p.images?.[0]?.publicId ? cloudinaryUrl(p.images[0].publicId, 88) : null,
      price: p.pricing?.finalPrice ?? 0,
      variants: p.variants.map((v) => ({ sku: v.sku, size: v.size, color: v.color, stock: v.stock })),
    })),
  });
});

export default router;
