import { env } from "../config/env.js";
import { connectDB } from "../config/db.js";
import { UserModel } from "../models/User.js";
import { hashPassword } from "../utils/password.js";
import mongoose from "mongoose";

async function main() {
  if (!env.ADMIN_SEED_EMAIL || !env.ADMIN_SEED_PASSWORD) {
    throw new Error(
      "Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD in backend/.env before running npm run seed:admin"
    );
  }

  await connectDB();

  const existing = await UserModel.findOne({ email: env.ADMIN_SEED_EMAIL });
  if (existing) {
    if (existing.role !== "admin") {
      existing.role = "admin";
      await existing.save();
      console.log(`Promoted existing user ${existing.email} to admin.`);
    } else {
      console.log(`Admin ${existing.email} already exists. Nothing to do.`);
    }
  } else {
    const passwordHash = await hashPassword(env.ADMIN_SEED_PASSWORD);
    const admin = await UserModel.create({
      name: env.ADMIN_SEED_NAME ?? "Admin",
      email: env.ADMIN_SEED_EMAIL,
      passwordHash,
      role: "admin",
    });
    console.log(`Created admin account: ${admin.email}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
