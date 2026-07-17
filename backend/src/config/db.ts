import mongoose from "mongoose";
import { env } from "./env";

let connectPromise: Promise<typeof mongoose> | null = null;
let listenersAttached = false;

// Nothing previously logged when the connection dropped or errored mid-
// runtime — operators would only see individual requests failing/hanging
// (Mongoose buffers commands for up to bufferTimeoutMS, ~10s, by default)
// with nothing pointing at "the DB connection is the cause."
function attachConnectionListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on("error", (err) => console.error("[mongodb] connection error:", err));
  mongoose.connection.on("disconnected", () => console.error("[mongodb] disconnected"));
  mongoose.connection.on("reconnected", () => console.log("[mongodb] reconnected"));
}

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;

  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is not set. Add your MongoDB Atlas connection string to backend/.env.");
  }

  attachConnectionListeners();

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
    // A failed *initial* connect used to leave connectPromise permanently
    // set to the rejected promise, so any later connectDB() call — a retry
    // after a transient boot-time DNS/auth hiccup — just re-rejected with
    // the same stale error forever instead of actually trying again.
    connectPromise.catch(() => {
      connectPromise = null;
    });
  }

  await connectPromise;
  return mongoose;
}
