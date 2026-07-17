import { createApp } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { sweepAppointments } from "./lib/appointments";
import { releaseStaleReservations } from "./services/order.service";
import { advanceMockShipments } from "./services/shipment.service";
import { serviceMock } from "./lib/integrations";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const MOCK_SHIPMENT_TICK_MS = 30 * 1000;

/** setInterval doesn't wait for an async callback to finish, so a slow tick
 * (or two server instances left running by accident) can overlap and double-
 * process the same shipment. This reschedules only after the previous run
 * settles, so ticks can never race each other within one process. */
function repeatEvery(intervalMs: number, ...tasks: Array<() => Promise<void>>) {
  const tick = async () => {
    await Promise.allSettled(tasks.map((task) => task().catch((err) => console.error("scheduled task failed:", err))));
    setTimeout(tick, intervalMs).unref();
  };
  setTimeout(tick, intervalMs).unref();
}

// Nothing in this codebase listened for these before, which meant a
// genuinely unhandled rejection or exception (a stream 'error' event with
// no listener, e.g.) crashed the whole process with just Node's default
// stack trace — taking down every in-flight request, not just the one that
// triggered it, with no log line pointing at what happened. Rejections are
// almost always recoverable (log and keep serving); Node's own guidance is
// that an uncaught *exception* leaves the process in a potentially corrupt
// state and the safe move is to log clearly and exit rather than keep
// running degraded — whatever process supervisor restarts this should pick
// it back up.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  process.exit(1);
});

async function main() {
  await connectDB();
  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`LuxeLoom backend listening on http://localhost:${env.port}`);
  });

  // Pickup-appointment reminders (24h/2h), no-show flagging, and release
  // of stock reserved by abandoned online payments.
  repeatEvery(SWEEP_INTERVAL_MS, sweepAppointments, releaseStaleReservations);

  // MOCK shipment simulator: every active parcel advances one checkpoint
  // per tick so tracking/returns/refunds are demoable without Blue Dart.
  // (Live mode would instead poll the Blue Dart tracking API every 15-30min.)
  if (serviceMock("BLUEDART")) {
    repeatEvery(MOCK_SHIPMENT_TICK_MS, advanceMockShipments);
  }
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
