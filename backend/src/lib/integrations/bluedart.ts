import crypto from "node:crypto";
import { INTEGRATIONS_MOCK, logIntegrationCall } from "./index";

export interface ServiceabilityResult {
  serviceable: boolean;
  etaDays?: number;
  message?: string;
}

/**
 * Blue Dart pincode serviceability. Mocked in development: any valid
 * 6-digit pincode not starting with 9 is serviceable, with a
 * deterministic 2–5 day ETA so the same pincode always answers the same.
 * The real Blue Dart serviceability API slots in here for M6.
 */
export async function checkServiceability(pincode: string): Promise<ServiceabilityResult> {
  logIntegrationCall("bluedart", "checkServiceability", { pincode, mock: INTEGRATIONS_MOCK });

  if (!/^\d{6}$/.test(pincode)) {
    return { serviceable: false, message: "Enter a valid 6-digit pincode" };
  }

  if (INTEGRATIONS_MOCK) {
    if (pincode.startsWith("9")) {
      return { serviceable: false, message: "Home delivery isn't available for this pincode yet" };
    }
    const hash = [...pincode].reduce((sum, c) => sum + c.charCodeAt(0), 0);
    return { serviceable: true, etaDays: 2 + (hash % 4) };
  }

  throw new Error("Live Blue Dart requires real credentials — set INTEGRATIONS_MOCK=true");
}

// ─── Waybill / pickup / tracking (M6) ───────────────────────────────────────
// The live Blue Dart APIs (waybill generation, pickup registration and
// tracking) slot into these wrappers once BLUEDART_LICENSE_KEY/LOGIN_ID are
// provisioned. Mock mode produces deterministic AWBs; tracking in mock mode
// is driven by the shipment simulator, so trackShipment is only consulted
// by the live 15-minute poller.

export interface WaybillResult {
  awbNumber: string;
}

export async function generateWaybill(opts: {
  orderNumber: string;
  codAmount?: number;
  destinationPincode: string;
  reverse?: boolean;
}): Promise<WaybillResult> {
  logIntegrationCall("bluedart", "generateWaybill", { ...opts, mock: INTEGRATIONS_MOCK });
  if (INTEGRATIONS_MOCK) {
    // Blue Dart AWBs are numeric; prefix distinguishes reverse pickups.
    const digits = String(parseInt(crypto.randomBytes(5).toString("hex"), 16)).slice(0, 9).padStart(9, "7");
    return { awbNumber: `${opts.reverse ? "9" : "1"}${digits}` };
  }
  throw new Error("Live Blue Dart requires real credentials — set INTEGRATIONS_MOCK=true");
}

export async function registerPickup(awbNumber: string, pickupDate: Date): Promise<{ confirmationNumber: string }> {
  logIntegrationCall("bluedart", "registerPickup", { awbNumber, pickupDate, mock: INTEGRATIONS_MOCK });
  if (INTEGRATIONS_MOCK) {
    return { confirmationNumber: `PU${awbNumber.slice(-6)}` };
  }
  throw new Error("Live Blue Dart requires real credentials — set INTEGRATIONS_MOCK=true");
}

export interface TrackingScan {
  status: string;
  location: string;
  timestamp: string;
}

/** Live-mode checkpoint scans for an AWB. Never called in mock mode — the
 * shipment simulator writes ShipmentEvents directly instead. */
export async function trackShipment(awbNumber: string): Promise<TrackingScan[]> {
  logIntegrationCall("bluedart", "trackShipment", { awbNumber, mock: INTEGRATIONS_MOCK });
  if (INTEGRATIONS_MOCK) return [];
  throw new Error("Live Blue Dart requires real credentials — set INTEGRATIONS_MOCK=true");
}
