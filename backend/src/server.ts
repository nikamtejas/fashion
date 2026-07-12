import { createApp } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { sweepAppointments } from "./lib/appointments";
import { releaseStaleReservations } from "./services/order.service";
import { advanceMockShipments } from "./services/shipment.service";
import { INTEGRATIONS_MOCK } from "./lib/integrations";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const MOCK_SHIPMENT_TICK_MS = 30 * 1000;

async function main() {
  await connectDB();
  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`LuxeLoom backend listening on http://localhost:${env.port}`);
  });

  // Pickup-appointment reminders (24h/2h), no-show flagging, and release
  // of stock reserved by abandoned online payments.
  setInterval(() => {
    sweepAppointments().catch((err) => console.error("appointment sweep failed:", err));
    releaseStaleReservations().catch((err) => console.error("reservation cleanup failed:", err));
  }, SWEEP_INTERVAL_MS).unref();

  // MOCK shipment simulator: every active parcel advances one checkpoint
  // per tick so tracking/returns/refunds are demoable without Blue Dart.
  // (Live mode would instead poll the Blue Dart tracking API every 15-30min.)
  if (INTEGRATIONS_MOCK) {
    setInterval(() => {
      advanceMockShipments().catch((err) => console.error("mock shipment tick failed:", err));
    }, MOCK_SHIPMENT_TICK_MS).unref();
  }
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
