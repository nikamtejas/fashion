import { createApp } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { sweepAppointments } from "./lib/appointments";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

async function main() {
  await connectDB();
  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`LuxeLoom backend listening on http://localhost:${env.port}`);
  });

  // Pickup-appointment reminders (24h/2h) and no-show flagging.
  setInterval(() => {
    sweepAppointments().catch((err) => console.error("appointment sweep failed:", err));
  }, SWEEP_INTERVAL_MS).unref();
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
