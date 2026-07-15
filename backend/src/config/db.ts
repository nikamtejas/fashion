import mongoose from "mongoose";
import { env } from "./env";

let connectPromise: Promise<typeof mongoose> | null = null;

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;

  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is not set. Add your MongoDB Atlas connection string to backend/.env.");
  }

  if (!connectPromise) {
    // TCP+TLS handshakes to this Atlas cluster are unusually slow (observed
    // several seconds each) — keep a handful of connections warm so most
    // requests reuse an already-established connection instead of paying
    // that setup cost, and don't let idle connections get dropped quickly.
    connectPromise = mongoose.connect(env.mongodbUri, {
      minPoolSize: 5,
      maxPoolSize: 20,
      maxIdleTimeMS: 10 * 60 * 1000,
    });
  }

  await connectPromise;
  return mongoose;
}
