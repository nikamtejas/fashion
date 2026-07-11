import mongoose from "mongoose";
import { env } from "./env";

let connectPromise: Promise<typeof mongoose> | null = null;

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;

  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is not set. Add your MongoDB Atlas connection string to backend/.env.");
  }

  if (!connectPromise) {
    connectPromise = mongoose.connect(env.mongodbUri);
  }

  await connectPromise;
  return mongoose;
}
