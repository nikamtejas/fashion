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

  throw new Error("Live Blue Dart serviceability arrives with Milestone 6 — set INTEGRATIONS_MOCK=true");
}
