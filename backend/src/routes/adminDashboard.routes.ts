import { Router } from "express";
import { requireAdmin } from "../middleware/auth";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { User } from "../models/User";
import { Payment } from "../models/Payment";
import { RefundRequest } from "../models/RefundRequest";
import { PickupAppointment } from "../models/PickupAppointment";

const router = Router();
router.use(requireAdmin);

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Local calendar-day key. parseRange interprets from/to in server-local
 * time, so buckets and order keys must too — keying with toISOString()
 * (UTC) shifted every label a day back and dropped "today" entirely. */
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const REVENUE_STATUSES = { $nin: ["PENDING_PAYMENT", "CANCELLED"] as const };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Malformed from/to (bad format, or a value that still produces an Invalid
// Date) used to silently flow into the Order query and the daily-bucket
// loop below as NaN, rendering an empty dashboard instead of either using
// the default range or telling the caller the input was bad.
function parseRange(req: { query: Record<string, unknown> }): { from: Date; to: Date } {
  const toRaw = req.query.to;
  const to =
    typeof toRaw === "string" && DATE_ONLY.test(toRaw) && !Number.isNaN(new Date(`${toRaw}T23:59:59`).getTime())
      ? new Date(`${toRaw}T23:59:59`)
      : new Date();

  const fromRaw = req.query.from;
  const from =
    typeof fromRaw === "string" && DATE_ONLY.test(fromRaw) && !Number.isNaN(new Date(`${fromRaw}T00:00:00`).getTime())
      ? new Date(`${fromRaw}T00:00:00`)
      : new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);

  return { from, to };
}

router.get("/", async (req, res) => {
  const { from, to } = parseRange(req as never);
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(dayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [orders, rangeOrders] = await Promise.all([
    Order.find({ status: REVENUE_STATUSES, createdAt: { $gte: weekStart < monthStart ? weekStart : monthStart } })
      .select("pricing createdAt")
      .lean(),
    Order.find({ status: REVENUE_STATUSES, createdAt: { $gte: from, $lte: to } })
      .select("items pricing status deliveryMethod coupon createdAt")
      .lean(),
  ]);

  // Defensive: the shared dev database has carried documents from an older
  // schema before — never let a malformed order take the dashboard down.
  const sum = (list: { pricing?: { total?: number } }[]) =>
    round2(list.reduce((s, o) => s + (o.pricing?.total ?? 0), 0));
  const revenueToday = sum(orders.filter((o) => o.createdAt >= dayStart));
  const revenueWeek = sum(orders.filter((o) => o.createdAt >= weekStart));
  const revenueMonth = sum(orders.filter((o) => o.createdAt >= monthStart));

  // Range KPIs
  const orderCount = rangeOrders.length;
  const rangeRevenue = sum(rangeOrders);
  const avgOrderValue = orderCount ? round2(rangeRevenue / orderCount) : 0;

  // Everything below only depends on rangeOrders, so hit Atlas once in
  // parallel instead of paying a round trip per query — including the
  // payment-method split (previously issued as its own query afterward,
  // paying a 3rd sequential Atlas round trip for data that only needed
  // orderIds, already available at this point).
  const productIds = [...new Set(rangeOrders.flatMap((o) => o.items.map((i) => String(i.product))))];
  const orderIds = rangeOrders.map((o) => o._id);
  const [products, refunds, customerCount, funnelAgg, recentOrders, lowStockProducts, pendingPickups, pendingRefunds, payments] =
    await Promise.all([
      Product.find({ _id: { $in: productIds } })
        .select("pricing.profitPerUnit category name")
        .populate("category", "name")
        .lean(),
      RefundRequest.find({ status: "REFUNDED", updatedAt: { $gte: from, $lte: to } })
        .select("refundAmount")
        .lean(),
      User.countDocuments({ role: "CUSTOMER" }),
      Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Order.find().sort({ createdAt: -1 }).limit(6).populate("user", "email").select("orderNumber status pricing.total createdAt user").lean(),
      Product.find({ status: "PUBLISHED", "variants.stock": { $lt: 5 } }).select("name slug variants").limit(20).lean(),
      // type: "PICKUP" — otherwise this double-counts against the separate
      // pendingRefunds stat, since in-store return drop-offs live in the
      // same collection.
      PickupAppointment.countDocuments({ type: "PICKUP", status: { $in: ["BOOKED", "READY"] } }),
      RefundRequest.countDocuments({ status: { $in: ["REQUESTED", "APPROVED", "ITEM_PICKED_UP", "RECEIVED"] } }),
      Payment.find({ order: { $in: orderIds } }).select("method order").lean(),
    ]);

  // True profit from the M3 breakdown stored on each product, minus the
  // coupon discounts given in the range.
  const profitBySku = new Map(products.map((p) => [String(p._id), p.pricing?.profitPerUnit ?? 0]));
  let grossProfit = 0;
  let discountGiven = 0;
  for (const o of rangeOrders) {
    discountGiven += o.pricing.discount;
    for (const item of o.items) grossProfit += (profitBySku.get(String(item.product)) ?? 0) * item.qty;
  }
  const trueProfit = round2(grossProfit - discountGiven);

  // Refund rate: refunded value ÷ range revenue.
  const refundedValue = round2(refunds.reduce((s, r) => s + (r.refundAmount ?? 0), 0));
  const refundRate = rangeRevenue > 0 ? round2((refundedValue / rangeRevenue) * 100) : 0;

  // Honest proxy — there's no visitor analytics yet.
  const ordersPerCustomer = customerCount ? round2(orderCount / customerCount) : 0;

  // Daily revenue series (also used for sparklines).
  const daily = new Map<string, { revenue: number; orders: number }>();
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    daily.set(dayKey(d), { revenue: 0, orders: 0 });
  }
  for (const o of rangeOrders) {
    const key = dayKey(o.createdAt);
    const entry = daily.get(key);
    if (entry) {
      entry.revenue = round2(entry.revenue + o.pricing.total);
      entry.orders += 1;
    }
  }
  const revenueSeries = [...daily.entries()].map(([date, v]) => ({ date, revenue: v.revenue, orders: v.orders }));

  // Sales by category + top products.
  const catByProduct = new Map(
    products.map((p) => [String(p._id), (p.category as unknown as { name?: string })?.name ?? "Other"])
  );
  const byCategory = new Map<string, number>();
  const byProduct = new Map<string, { name: string; revenue: number; qty: number }>();
  for (const o of rangeOrders) {
    for (const item of o.items) {
      const cat = catByProduct.get(String(item.product)) ?? "Other";
      byCategory.set(cat, round2((byCategory.get(cat) ?? 0) + item.price * item.qty));
      const entry = byProduct.get(String(item.product)) ?? { name: item.name, revenue: 0, qty: 0 };
      entry.revenue = round2(entry.revenue + item.price * item.qty);
      entry.qty += item.qty;
      byProduct.set(String(item.product), entry);
    }
  }
  const categorySeries = [...byCategory.entries()].map(([name, revenue]) => ({ name, revenue }));
  const topProducts = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Payment-method split.
  const totalByOrder = new Map(rangeOrders.map((o) => [String(o._id), o.pricing.total]));
  const byMethod = new Map<string, number>();
  for (const p of payments) {
    byMethod.set(p.method, round2((byMethod.get(p.method) ?? 0) + (totalByOrder.get(String(p.order)) ?? 0)));
  }
  const paymentSeries = [...byMethod.entries()].map(([method, revenue]) => ({ method, revenue }));

  // Order-status funnel (range, all statuses).
  const FUNNEL = ["PLACED", "CONFIRMED", "PACKED", "PICKUP_SCHEDULED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];
  const funnelMap = new Map(funnelAgg.map((f) => [f._id as string, f.count as number]));
  // Each stage counts orders that reached it or beyond.
  const funnel = FUNNEL.map((stage, i) => ({
    stage,
    count: FUNNEL.slice(i).reduce((s, st) => s + (funnelMap.get(st) ?? 0), 0),
  }));

  // Live feeds.
  const lowStock = lowStockProducts
    .flatMap((p) => p.variants.filter((v) => v.stock < 5).map((v) => ({ name: p.name, slug: p.slug, sku: v.sku, size: v.size, color: v.color, stock: v.stock })))
    .slice(0, 12);

  res.json({
    range: { from: dayKey(from), to: dayKey(to) },
    kpis: {
      revenueToday,
      revenueWeek,
      revenueMonth,
      orderCount,
      avgOrderValue,
      trueProfit,
      refundRate,
      refundedValue,
      ordersPerCustomer,
      customerCount,
    },
    revenueSeries,
    categorySeries,
    topProducts,
    paymentSeries,
    funnel,
    feeds: { recentOrders, lowStock, pendingPickups, pendingRefunds },
  });
});

/** CSV export of the range's orders. */
router.get("/export.csv", async (req, res) => {
  const { from, to } = parseRange(req as never);
  const orders = await Order.find({ createdAt: { $gte: from, $lte: to } })
    .sort({ createdAt: 1 })
    .populate("user", "email")
    .lean();

  const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const rows = [
    ["Order", "Date", "Customer", "Method", "Status", "Items", "Subtotal", "Discount", "GST", "Shipping", "Total"].join(","),
    ...orders.map((o) =>
      [
        esc(o.orderNumber),
        esc(o.createdAt.toISOString().slice(0, 10)),
        esc((o.user as unknown as { email?: string })?.email),
        esc(o.deliveryMethod),
        esc(o.status),
        esc(o.items.reduce((s, i) => s + i.qty, 0)),
        o.pricing.subtotal,
        o.pricing.discount,
        o.pricing.gst,
        o.pricing.shipping,
        o.pricing.total,
      ].join(",")
    ),
  ];

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="orders-${req.query.from ?? "all"}.csv"`);
  res.send(rows.join("\n"));
});

export default router;
