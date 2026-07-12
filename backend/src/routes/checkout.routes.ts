import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { placeOrder, HttpError } from "../services/order.service";
import { User } from "../models/User";

const router = Router();
router.use(requireAuth);

const addressSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  line1: z.string().min(3),
  line2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/),
});

const placeOrderSchema = z
  .object({
    deliveryMethod: z.enum(["HOME", "PICKUP"]),
    addressId: z.string().optional(),
    address: addressSchema.optional(),
    storeId: z.string().optional(),
    appointment: z
      .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), timeSlot: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/) })
      .optional(),
  })
  .refine((d) => d.deliveryMethod === "PICKUP" || d.addressId || d.address, {
    message: "Provide a delivery address",
  })
  .refine((d) => d.deliveryMethod === "HOME" || (d.storeId && d.appointment), {
    message: "Pick a store and appointment slot",
  });

router.post("/place-order", async (req, res) => {
  const parsed = placeOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });

  let address = parsed.data.address;
  if (parsed.data.deliveryMethod === "HOME" && parsed.data.addressId) {
    const user = await User.findById(req.user!.uid).select("addresses").lean();
    const saved = user?.addresses.find((a) => String(a._id) === parsed.data.addressId);
    if (!saved) return res.status(404).json({ error: "Saved address not found" });
    address = {
      name: saved.name,
      phone: saved.phone,
      line1: saved.line1,
      line2: saved.line2 ?? undefined,
      city: saved.city,
      state: saved.state,
      pincode: saved.pincode,
    };
  }

  try {
    const order = await placeOrder({
      userId: req.user!.uid,
      deliveryMethod: parsed.data.deliveryMethod,
      address,
      storeId: parsed.data.storeId,
      appointment: parsed.data.appointment,
    });
    res.status(201).json({ order });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

export default router;
