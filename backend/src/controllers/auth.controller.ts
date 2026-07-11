import type { Request, Response } from "express";
import { UserModel } from "../models/User.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { signSession } from "../utils/jwt.js";
import { setSessionCookie, clearSessionCookie } from "../utils/cookies.js";
import { signupSchema, loginSchema, addAddressSchema } from "../validators/auth.validators.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

interface UserAddress {
  _id: unknown;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean | null;
}

function toPublicUser(user: {
  _id: unknown;
  name: string;
  email: string;
  phone?: string | null;
  whatsappNumber?: string | null;
  role: string;
  addresses?: UserAddress[];
}) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    whatsappNumber: user.whatsappNumber ?? null,
    role: user.role,
    addresses: (user.addresses ?? []).map((a) => ({
      id: String(a._id),
      line1: a.line1,
      line2: a.line2 ?? null,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      isDefault: Boolean(a.isDefault),
    })),
  };
}

// Public signup always creates a customer account. Admin accounts are provisioned
// via `npm run seed:admin` so the admin role can never be self-assigned over the API.
export const signup = asyncHandler(async (req: Request, res: Response) => {
  const input = signupSchema.parse(req.body);

  const existing = await UserModel.findOne({ email: input.email });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash,
    phone: input.phone,
    role: "customer",
  });

  const token = signSession({ sub: String(user._id), role: "customer" });
  setSessionCookie(res, token);
  res.status(201).json({ user: toPublicUser(user) });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);

  const user = await UserModel.findOne({ email: input.email }).select("+passwordHash");
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, "Invalid email or password");
  }

  const token = signSession({ sub: String(user._id), role: user.role as "customer" | "admin" });
  setSessionCookie(res, token);
  res.json({ user: toPublicUser(user) });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.status(204).send();
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.session) {
    throw new ApiError(401, "Not authenticated");
  }
  const user = await UserModel.findById(req.session.sub);
  if (!user) {
    throw new ApiError(401, "Not authenticated");
  }
  res.json({ user: toPublicUser(user) });
});

export const addAddress = asyncHandler(async (req: Request, res: Response) => {
  const input = addAddressSchema.parse(req.body);
  const user = await UserModel.findById(req.session!.sub);
  if (!user) {
    throw new ApiError(401, "Not authenticated");
  }

  if (input.isDefault || user.addresses.length === 0) {
    user.addresses.forEach((a) => {
      a.isDefault = false;
    });
    input.isDefault = true;
  }
  user.addresses.push(input);
  await user.save();

  res.status(201).json({ user: toPublicUser(user) });
});
