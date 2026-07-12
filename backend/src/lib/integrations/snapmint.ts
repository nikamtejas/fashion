import crypto from "node:crypto";
import { INTEGRATIONS_MOCK, logIntegrationCall } from "./index";

// Snapmint EMI. MOCK mode simulates the whole approval flow (the frontend
// shows a ~3s "approval" wait); the live API slots into these wrappers when
// SNAPMINT_MERCHANT_ID/SNAPMINT_API_KEY are provisioned.

export const EMI_TENURES = [3, 6, 9, 12] as const;
export type EmiTenure = (typeof EMI_TENURES)[number];

// Flat total-interest per tenure for the mock plan math — deterministic so
// the same amount always quotes the same installments.
const TENURE_INTEREST: Record<EmiTenure, number> = { 3: 0, 6: 0.04, 9: 0.07, 12: 0.1 };

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface EmiPlan {
  tenureMonths: EmiTenure;
  monthlyAmount: number;
  downPayment: number;
  totalPayable: number;
  interestPct: number;
}

/** Installment quotes for a given payable amount. Pure math, shared by the
 * product-page widget, the cart widget and the payment step. */
export function computeEmiPlans(amountRupees: number): EmiPlan[] {
  return EMI_TENURES.map((tenure) => {
    const interestPct = TENURE_INTEREST[tenure];
    const totalPayable = round2(amountRupees * (1 + interestPct));
    return {
      tenureMonths: tenure,
      monthlyAmount: round2(totalPayable / tenure),
      downPayment: 0,
      totalPayable,
      interestPct: interestPct * 100,
    };
  });
}

export interface SnapmintOrder {
  snapmintOrderId: string;
  /** Where the customer completes approval (mock: handled in-app). */
  approvalUrl: string;
}

export async function createSnapmintOrder(
  amountRupees: number,
  tenure: EmiTenure,
  receipt: string
): Promise<SnapmintOrder> {
  logIntegrationCall("snapmint", "createOrder", { amountRupees, tenure, receipt, mock: INTEGRATIONS_MOCK });

  if (INTEGRATIONS_MOCK) {
    return {
      snapmintOrderId: `snpm_MOCK${crypto.randomBytes(6).toString("hex")}`,
      approvalUrl: "mock://snapmint-approval",
    };
  }

  throw new Error("Live Snapmint integration requires real credentials — set INTEGRATIONS_MOCK=true");
}

/** Cancellation wrapper — wired for Milestone 6's returns flow. */
export async function cancelSnapmintOrder(snapmintOrderId: string): Promise<{ cancelled: boolean }> {
  logIntegrationCall("snapmint", "cancel", { snapmintOrderId, mock: INTEGRATIONS_MOCK });
  if (INTEGRATIONS_MOCK) return { cancelled: true };
  throw new Error("Live Snapmint integration requires real credentials — set INTEGRATIONS_MOCK=true");
}
